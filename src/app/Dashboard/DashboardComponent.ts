import { Component, OnInit, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { TransacaoService } from '../services/transacao';
import { ChartConfiguration, ChartOptions, Chart, ChartType } from 'chart.js';
import { registerables } from 'chart.js';
import { CommonModule } from '@angular/common'; 
import { BaseChartDirective } from 'ng2-charts';
import { ReactiveFormsModule, FormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, ReactiveFormsModule, FormsModule],
  templateUrl: './Dashboard.html', 
  styleUrls: ['./dashboard.css']   
})
export class DashboardComponent implements OnInit {
  
  @ViewChildren(BaseChartDirective) charts: QueryList<BaseChartDirective> | undefined;

  listaTransacoes: any[] = []; 
  transacoesFiltradas: any[] = []; 
  termoBusca: string = '';
  
  saldoAtual: number = 0;
  totalEntradas: number = 0;
  totalSaidas: number = 0;
  
  exibirSucesso: boolean = false;
  isDarkMode: boolean = false;
  percentualGasto: number = 0;

  gastoForm = new FormGroup({
    descricao: new FormControl('', [Validators.required]),
    valor: new FormControl('', [Validators.required]), 
    data: new FormControl('', [Validators.required]),
    tipo: new FormControl('', [Validators.required]),
    classificacao: new FormControl('', [Validators.required])
  });

  // CONFIGURAÇÕES DOS GRÁFICOS
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Gastos por Mês (R$)', backgroundColor: '#3498db', borderRadius: 5 }]
  };

  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
      y: { beginAtZero: true, ticks: { color: '#2c3e50' }, grid: { color: 'rgba(0,0,0,0.1)' } },
      x: { ticks: { color: '#2c3e50' }, grid: { display: false } }
    },
    plugins: { legend: { labels: { color: '#2c3e50' } } }
  };

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{ 
      data: [], 
      label: 'Evolução do Saldo (R$)', 
      borderColor: '#3498db', 
      backgroundColor: 'rgba(52, 152, 219, 0.2)', 
      fill: true,
      tension: 0.4 
    }]
  };

  // Criado para evitar erro de referência no HTML linha 119
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
      y: { ticks: { color: '#2c3e50' }, grid: { color: 'rgba(0,0,0,0.1)' } },
      x: { ticks: { color: '#2c3e50' } }
    },
    plugins: { legend: { labels: { color: '#2c3e50' } } }
  };

  public pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#3498db', '#f1c40f', '#e74c3c', '#2ecc71', '#9b59b6'] }]
  };

  public pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: '#2c3e50' } } }
  };

  constructor(private service: TransacaoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.carregarDados();
  }

  carregarDados() {
    this.service.listar().subscribe({
      next: (dados) => {
        this.listaTransacoes = dados;
        this.transacoesFiltradas = [...dados];
        this.atualizarMetricas(dados);
        this.gerarGraficos();
      },
      error: (err) => console.error('Erro ao buscar:', err)
    });
  }

  private gerarGraficos() {
    this.gerarGraficoMensal(); 
    this.gerarGraficoGastosPorDescricao(); 
    this.gerarGraficoEvolucao(); 
  }

  private atualizarMetricas(dados: any[]) {
    this.totalEntradas = dados.filter(t => t.tipo?.toUpperCase() === 'ENTRADA').reduce((acc, t) => acc + Number(t.valor), 0);
    this.totalSaidas = dados.filter(t => t.tipo?.toUpperCase() === 'SAIDA').reduce((acc, t) => acc + Number(t.valor), 0);
    this.saldoAtual = this.totalEntradas - this.totalSaidas;
    this.percentualGasto = this.totalEntradas > 0 ? (this.totalSaidas / this.totalEntradas) * 100 : 0;
  }

  formatarMoeda(event: any) {
    let v = event.target.value.replace(/\D/g, '');
    if (!v) { this.gastoForm.get('valor')!.setValue(''); return; }
    const formatado = (Number(v) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    event.target.value = formatado;
    this.gastoForm.get('valor')!.setValue(formatado, { emitEvent: false });
  }

  salvarGasto() {
    if (this.gastoForm.valid) {
      // Limpeza simples para converter "R$ 10,00" em 10.00 antes de enviar
      const valorLimpo = this.gastoForm.value.valor?.toString().replace(/[R$\s.]/g, '').replace(',', '.');
      const payload = { ...this.gastoForm.value, valor: Number(valorLimpo) };

      this.service.salvar(payload).subscribe({
        next: () => {
          this.exibirSucesso = true;
          this.gastoForm.reset();
          this.carregarDados();
          setTimeout(() => this.exibirSucesso = false, 3000);
        },
        error: (err) => console.error('Erro ao salvar:', err)
      });
    }
  }

  excluirTransacao(id: any) {
    if (confirm('Deseja realmente excluir esta transação?')) {
      this.service.deletar(id).subscribe({
        next: () => this.carregarDados(),
        error: (err) => console.error('Erro ao excluir:', err)
      });
    }
  }

  filtrarTransacoes() {
    this.transacoesFiltradas = this.listaTransacoes.filter(t => 
      t.descricao?.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
      t.classificacao?.toLowerCase().includes(this.termoBusca.toLowerCase())
    );
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode');
    
    const corTexto = this.isDarkMode ? '#e0e0e0' : '#2c3e50';
    const corGrade = this.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    // RESOLUÇÃO TS4111: Atualizando opções de forma segura
    const updateOptions = (options: any) => {
      if (options.scales) {
        if (options.scales['y']?.ticks) options.scales['y'].ticks.color = corTexto;
        if (options.scales['y']?.grid) options.scales['y'].grid.color = corGrade;
        if (options.scales['x']?.ticks) options.scales['x'].ticks.color = corTexto;
      }
      if (options.plugins?.legend?.labels) {
        options.plugins.legend.labels.color = corTexto;
      }
    };

    updateOptions(this.barChartOptions);
    updateOptions(this.lineChartOptions);
    updateOptions(this.pieChartOptions);

    this.renderizarGraficos();
  }

  exportarPDF() {
  const doc = new jsPDF();
  
  // Título do Documento
  doc.setFontSize(18);
  doc.text('Relatório Financeiro Detalhado', 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['DATA', 'DESCRIÇÃO', 'CATEGORIA', 'TIPO', 'VALOR']],
    body: this.transacoesFiltradas.map(t => [
      // Formata a data para o padrão brasileiro no PDF
      new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'),
      t.descricao?.toUpperCase() || '',
      t.classificacao || '',
      t.tipo || '',
      // Garante que o valor apareça como moeda no PDF
      Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]),
    headStyles: { 
      fillColor: [52, 152, 219], // Azul padrão
      textColor: [255, 255, 255],
      fontStyle: 'bold' 
    },
    alternateRowStyles: { 
      fillColor: [245, 245, 245] 
    },
    margin: { top: 35 }
  });

  doc.save('relatorio_financeiro.pdf');
}

  private renderizarGraficos() {
    this.cdr.detectChanges();
    if (this.charts) {
      this.charts.forEach(chart => {
        chart.update();
      });
    }
  }

  gerarGraficoEvolucao() {
    const dias = Array.from({length: 31}, (_, i) => (i + 1).toString());
    let saldoAcumulado = 0;
    const evolucao = new Array(31).fill(null);
    
    const transacoesOrdenadas = [...this.listaTransacoes].sort((a, b) => 
      new Date(a.dataHora || a.data).getTime() - new Date(b.dataHora || b.data).getTime()
    );

    transacoesOrdenadas.forEach(t => {
      const data = new Date(t.dataHora || t.data);
      const dia = data.getDate() - 1;
      saldoAcumulado += t.tipo?.toUpperCase() === 'ENTRADA' ? Number(t.valor) : -Number(t.valor);
      if(dia >= 0 && dia < 31) evolucao[dia] = saldoAcumulado;
    });

    let ultimoSaldo = 0;
    for (let i = 0; i < evolucao.length; i++) {
      if (evolucao[i] === null) evolucao[i] = ultimoSaldo;
      else ultimoSaldo = evolucao[i];
    }

    this.lineChartData = {
      labels: dias,
      datasets: [{ ...this.lineChartData.datasets[0], data: evolucao }]
    };
    this.renderizarGraficos();
  }

  gerarGraficoGastosPorDescricao() {
    const agrupado: { [key: string]: number } = {};
    this.listaTransacoes.filter(t => t.tipo?.toUpperCase() === 'SAIDA').forEach(t => {
      const desc = t.descricao?.toUpperCase() || 'OUTROS';
      agrupado[desc] = (agrupado[desc] || 0) + Number(t.valor);
    });

    this.pieChartData = {
      labels: Object.keys(agrupado),
      datasets: [{ ...this.pieChartData.datasets[0], data: Object.values(agrupado) }]
    };
    this.renderizarGraficos();
  }

  gerarGraficoMensal() {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const valores = new Array(12).fill(0);
    
    this.listaTransacoes.forEach(t => {
      if (t.tipo?.toUpperCase() === 'SAIDA') {
        const d = new Date(t.dataHora || t.data);
        if (!isNaN(d.getTime())) valores[d.getMonth()] += Number(t.valor);
      }
    });

    this.barChartData = { 
      labels: meses, 
      datasets: [{ ...this.barChartData.datasets[0], data: [...valores] }] 
    };
    this.renderizarGraficos();
  }
}