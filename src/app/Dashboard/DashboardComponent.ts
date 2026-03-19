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

  gastoForm = new FormGroup({
    descricao: new FormControl('', [Validators.required]),
    valor: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    data: new FormControl('', [Validators.required]),
    tipo: new FormControl('', [Validators.required]),
    classificacao: new FormControl('', [Validators.required])
  });

  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Valores (R$)', backgroundColor: '#3498db', borderColor: '#2980b9', borderWidth: 1, borderRadius: 5 }]
  };

  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  };

  public pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#3498db', '#f1c40f', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12'] }]
  };

  public pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed || 0;
            return ` R$ ${value.toFixed(2)}`;
          }
        }
      }
    }
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

        this.gerarGraficoMensal(); 
        this.gerarGraficoGastosPorDescricao(); 
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erro ao buscar transações:', err)
    });
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

  // --- SOLUÇÃO DO ERRO TS2339: MÉTODO DIÁRIO ADICIONADO ---
  gerarGraficoDiario() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const gastosHoje = this.listaTransacoes.filter(t => {
      const dataT = new Date(t.dataHora || t.data).toLocaleDateString('pt-BR');
      return dataT === hoje && t.tipo?.toUpperCase() === 'SAIDA';
    });

    const agrupado: { [key: string]: number } = {};
    gastosHoje.forEach(t => {
      const desc = t.descricao?.toUpperCase() || 'OUTROS';
      agrupado[desc] = (agrupado[desc] || 0) + Number(t.valor);
    });

    this.barChartData = {
      labels: Object.keys(agrupado).length > 0 ? Object.keys(agrupado) : ['Sem gastos hoje'],
      datasets: [{
        ...this.barChartData.datasets[0],
        data: Object.values(agrupado).length > 0 ? Object.values(agrupado) : [0],
        label: `Gastos de Hoje (${hoje})`,
        backgroundColor: '#f1c40f' // Cor amarela para diferenciar do mensal
      }]
    };
    this.renderizarGrafico();
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

  filtrarTransacoes() {
    this.transacoesFiltradas = this.listaTransacoes.filter(t => 
      t.descricao?.toLowerCase().includes(this.termoBusca.toLowerCase())
    );
  }

  formatarMoeda(event: any) {
    let valorRaw = event.target.value.replace(/\D/g, '');
    const valorNumerico = Number(valorRaw) / 100;
    event.target.value = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    this.gastoForm.get('valor')!.setValue(valorNumerico, { emitEvent: false });
  }

  exportarPDF() {
    const doc = new jsPDF();
    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(18);
    doc.text('Relatório de Controle Financeiro', 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Data: ${dataGeracao}`, 14, 30);
    
    // Adicionado resumo financeiro no PDF
    doc.setTextColor(46, 204, 113); // Verde
    doc.text(`Total Entradas: R$ ${this.totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 14, 38);
    doc.setTextColor(231, 76, 60); // Vermelho
    doc.text(`Total Saídas: R$ ${this.totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 14, 44);
    doc.setTextColor(44, 62, 80); // Cor padrão
    doc.setFont('helvetica', 'bold');
    doc.text(`Saldo Líquido: R$ ${this.saldoAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 14, 52);

    autoTable(doc, {
      startY: 60,
      head: [['Data', 'Descrição', 'Classificação', 'Tipo', 'Valor']],
      body: this.transacoesFiltradas.map(t => [
        new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'),
        t.descricao,
        t.classificacao,
        t.tipo,
        `R$ ${Number(t.valor).toFixed(2)}`
      ]),
      headStyles: { fillColor: [52, 152, 219] },
      didDrawPage: (data) => {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Gerado pelo Painel Financeiro', 14, pageHeight - 10);
        const paginaAtual = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.text(`Página ${paginaAtual}`, pageWidth - 30, pageHeight - 10);
      }
    });

    doc.save(`relatorio-${dataGeracao.replace(/\//g, '-')}.pdf`);
  }
}