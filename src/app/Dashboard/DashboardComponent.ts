import { Component, OnInit, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { TransacaoService } from '../services/transacao';
import { ChartConfiguration, ChartOptions, Chart } from 'chart.js';
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

  // CONFIGURAÇÕES DOS GRÁFICOS - Ajustadas para responsividade e cores dinâmicas
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Gastos por Mês (R$)', backgroundColor: '#3b82f6', borderRadius: 5 }]
  };

  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#64748b' } } }
  };

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{ 
      data: [], 
      label: 'Evolução do Saldo (R$)', 
      borderColor: '#3b82f6', 
      backgroundColor: 'rgba(59, 130, 246, 0.1)', 
      fill: true,
      tension: 0.3,
      pointRadius: 4
    }]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false } }
    },
    plugins: { legend: { display: true } }
  };

  public pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6'] }]
  };

  public pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  constructor(private service: TransacaoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.carregarDados();
  }

  carregarDados() {
    this.service.listar().subscribe({
      next: (dados) => {
        // Ordenação global por data para garantir consistência em todos os cálculos
        this.listaTransacoes = dados.sort((a, b) => 
          new Date(a.dataHora || a.data).getTime() - new Date(b.dataHora || b.data).getTime()
        );
        this.transacoesFiltradas = [...this.listaTransacoes];
        this.atualizarMetricas(this.listaTransacoes);
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
    const termo = this.termoBusca.toLowerCase();
    this.transacoesFiltradas = this.listaTransacoes.filter(t => 
      t.descricao?.toLowerCase().includes(termo) ||
      t.classificacao?.toLowerCase().includes(termo) ||
      t.tipo?.toLowerCase().includes(termo)
    );
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode');
    
    const corTexto = this.isDarkMode ? '#f8fafc' : '#1e293b';
    const corGrade = this.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    const updateOptions = (options: any) => {
      if (options.scales) {
        if (options.scales.y) {
          options.scales.y.ticks = { ...options.scales.y.ticks, color: corTexto };
          options.scales.y.grid = { ...options.scales.y.grid, color: corGrade };
        }
        if (options.scales.x) {
          options.scales.x.ticks = { ...options.scales.x.ticks, color: corTexto };
        }
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
    doc.setFontSize(18);
    doc.text('Relatório Financeiro Detalhado', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    doc.text(`Saldo Atual: ${this.saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 34);

    autoTable(doc, {
      startY: 40,
      head: [['DATA', 'DESCRIÇÃO', 'CATEGORIA', 'TIPO', 'VALOR']],
      body: this.transacoesFiltradas.map(t => [
        new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'),
        t.descricao?.toUpperCase() || '',
        t.classificacao || '',
        t.tipo || '',
        Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]),
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save('relatorio_financeiro.pdf');
  }

  private renderizarGraficos() {
    this.cdr.detectChanges();
    if (this.charts) {
      this.charts.forEach(chart => chart.update());
    }
  }

  // CORREÇÃO DO GRÁFICO DE EVOLUÇÃO (Elimina o "buraco" e as quedas para zero)
  gerarGraficoEvolucao() {
    const labels: string[] = [];
    const dadosEvolucao: number[] = [];
    let saldoAcumulado = 0;

    // Criamos um mapa para consolidar o saldo por dia
    const saldoPorDia = new Map<string, number>();

    this.listaTransacoes.forEach(t => {
      const dataStr = new Date(t.dataHora || t.data).toLocaleDateString('pt-BR');
      const valor = t.tipo?.toUpperCase() === 'ENTRADA' ? Number(t.valor) : -Number(t.valor);
      
      saldoAcumulado += valor;
      saldoPorDia.set(dataStr, saldoAcumulado);
    });

    // Extraímos os dados do mapa (que já está ordenado por causa da ordenação da lista inicial)
    saldoPorDia.forEach((valor, data) => {
      labels.push(data);
      dadosEvolucao.push(valor);
    });

    this.lineChartData = {
      labels: labels,
      datasets: [{ ...this.lineChartData.datasets[0], data: dadosEvolucao }]
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
      datasets: [{ ...this.barChartData.datasets[0], data: valores }] 
    };
    this.renderizarGraficos();
  }
}