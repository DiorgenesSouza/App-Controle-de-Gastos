import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
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
  
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

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
    valor: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    data: new FormControl('', [Validators.required]),
    tipo: new FormControl('', [Validators.required]),
    classificacao: new FormControl('', [Validators.required])
  });

  // --- CONFIGURAÇÕES DE GRÁFICOS ---
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Valores (R$)', backgroundColor: '#3498db', borderColor: '#2980b9', borderWidth: 1, borderRadius: 5 }]
  };

  public barChartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top' } },
    scales: { y: { beginAtZero: true } }
  };

  public pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#3498db', '#f1c40f', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12'] }]
  };

  public pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
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

  constructor(private service: TransacaoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.carregarDados();
  }

  carregarDados() {
    this.service.listar().subscribe({
      next: (dados) => {
        this.listaTransacoes = dados;
        this.transacoesFiltradas = [...dados];

        this.totalEntradas = dados
          .filter(t => t.tipo?.toUpperCase() === 'ENTRADA')
          .reduce((acc, t) => acc + Number(t.valor), 0);

        this.totalSaidas = dados
          .filter(t => t.tipo?.toUpperCase() === 'SAIDA')
          .reduce((acc, t) => acc + Number(t.valor), 0);

        this.saldoAtual = this.totalEntradas - this.totalSaidas;
        this.percentualGasto = this.totalEntradas > 0 ? (this.totalSaidas / this.totalEntradas) * 100 : 0;

        this.gerarGraficoMensal(); 
        this.gerarGraficoGastosPorDescricao(); 
        this.gerarGraficoEvolucao(); 
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao buscar transações:', err)
    });
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode');
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
      const valor = t.tipo?.toUpperCase() === 'ENTRADA' ? Number(t.valor) : -Number(t.valor);
      saldoAcumulado += valor;
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
    this.renderizarGrafico();
  }

  gerarGraficoGastosPorDescricao() {
    const gastos = this.listaTransacoes.filter(t => t.tipo?.toUpperCase() === 'SAIDA');
    const agrupado: { [key: string]: number } = {};

    gastos.forEach(t => {
      const desc = t.descricao?.toUpperCase() || 'OUTROS';
      agrupado[desc] = (agrupado[desc] || 0) + Number(t.valor);
    });

    this.pieChartData = {
      labels: Object.keys(agrupado),
      datasets: [{ ...this.pieChartData.datasets[0], data: Object.values(agrupado) }]
    };
    this.renderizarGrafico();
  }

  gerarGraficoMensal() {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const valores = new Array(12).fill(0);

    this.listaTransacoes.forEach(t => {
      if (t.tipo?.toUpperCase() === 'SAIDA') {
        const dataT = new Date(t.dataHora || t.data);
        if (!isNaN(dataT.getTime())) valores[dataT.getMonth()] += Number(t.valor);
      }
    });

    this.barChartData = {
      labels: meses,
      datasets: [{ ...this.barChartData.datasets[0], data: [...valores], label: 'Gastos por Mês (R$)', backgroundColor: '#3498db' }]
    };
    this.renderizarGrafico();
  }

  private renderizarGrafico() {
    this.cdr.detectChanges();
    if (this.chart && this.chart.chart) {
      this.chart.chart.update();
    }
  }

  salvarGasto() {
    if (this.gastoForm.valid) {
      this.service.salvar(this.gastoForm.value).subscribe({
        next: () => {
          this.exibirSucesso = true;
          this.gastoForm.reset();
          this.carregarDados(); 
          setTimeout(() => this.exibirSucesso = false, 3000);
        },
        error: (err) => alert('Erro ao salvar!')
      });
    }
  }

  excluirTransacao(id: number) {
    if (confirm('Deseja realmente excluir?')) {
      this.service.deletar(id).subscribe({
        next: () => this.carregarDados(),
        error: (err) => alert('Erro ao excluir!')
      });
    }
  }

  filtrarTransacoes() {
    this.transacoesFiltradas = this.listaTransacoes.filter(t => 
      t.descricao?.toLowerCase().includes(this.termoBusca.toLowerCase())
    );
  }

  // --- LÓGICA DE FORMATAÇÃO REVISADA ---
  formatarMoeda(event: any) {
    let valorRaw = event.target.value.replace(/\D/g, ''); 
    
    if (!valorRaw) {
      this.gastoForm.get('valor')!.setValue(null);
      return;
    }

    // Transformar a string de números em decimal (ex: "17900" -> 179.00)
    const valorNumerico = Number(valorRaw) / 100;

    // Formata visualmente para o input
    const valorFormatado = valorNumerico.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2 
    });

    // Atualiza o valor exibido no campo sem disparar novos eventos de input infinitos
    event.target.value = valorFormatado;
    
    // Atualiza o valor numérico puro no FormControll (o que vai para o JSON do banco)
    this.gastoForm.get('valor')!.setValue(valorNumerico, { emitEvent: false });
    this.gastoForm.get('valor')!.markAsDirty();
    this.gastoForm.get('valor')!.updateValueAndValidity();
  }

  exportarPDF() {
    const doc = new jsPDF();
    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(18);
    doc.text('Relatório de Controle Financeiro', 14, 20);
    autoTable(doc, {
      startY: 60,
      head: [['Data', 'Descrição', 'Classificação', 'Tipo', 'Valor']],
      body: this.transacoesFiltradas.map(t => [
        new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'),
        t.descricao,
        t.classificacao,
        t.tipo,
        `R$ ${Number(t.valor).toFixed(2)}`
      ])
    });
    doc.save(`relatorio-${dataGeracao.replace(/\//g, '-')}.pdf`);
  }
}