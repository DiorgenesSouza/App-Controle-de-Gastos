import { Component, OnInit, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { TransacaoService } from '../services/transacao';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
import { CommonModule } from '@angular/common'; 
import { BaseChartDirective } from 'ng2-charts';
import { ReactiveFormsModule, FormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

// Import corrigido para evitar o erro TS2306
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

Chart.register(...registerables);

interface Transacao {
  id?: any;
  descricao: string;
  valor: number; 
  data: string;
  dataHora?: string;
  tipo: 'ENTRADA' | 'SAIDA';
  classificacao: 'FIXA' | 'VARIAVEL';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, ReactiveFormsModule, FormsModule],
  templateUrl: './Dashboard.html', 
  styleUrls: ['./dashboard.css']   
})
export class DashboardComponent implements OnInit {
  
  @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;

  listaTransacoes: Transacao[] = []; 
  transacoesFiltradas: Transacao[] = []; 
  termoBusca: string = '';
  exibirSucesso: boolean = false;
  isDarkMode: boolean = false;
  
  mesSelecionado: number = new Date().getMonth();
  anoSelecionado: number = new Date().getFullYear();
  
  saldoAtual: number = 0;
  totalEntradas: number = 0;
  totalSaidas: number = 0;
  percentualGasto: number = 0;

  gastoForm = new FormGroup({
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    valor: new FormControl('', { nonNullable: true, validators: [Validators.required] }), 
    data: new FormControl(new Date().toISOString().substring(0, 10), { nonNullable: true, validators: [Validators.required] }),
    tipo: new FormControl<'ENTRADA' | 'SAIDA' | ''>('', { nonNullable: true, validators: [Validators.required] }),
    classificacao: new FormControl<'FIXA' | 'VARIAVEL' | ''>('', { nonNullable: true, validators: [Validators.required] })
  });

  /* --- CONFIGURAÇÕES DOS GRÁFICOS --- */

  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    datasets: [{ data: [], label: 'Gastos (R$)', backgroundColor: '#3b82f6', borderRadius: 5 }]
  };

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{ 
      data: [], 
      label: 'Saldo Acumulado (R$)', 
      borderColor: '#22c55e', 
      backgroundColor: 'rgba(34, 197, 94, 0.1)', 
      fill: true,
      tension: 0.3
    }]
  };

  public categoryPieData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Fixa', 'Variável'],
    datasets: [{ data: [], backgroundColor: ['#f59e0b', '#8b5cf6'] }]
  };

  public descriptionPieData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#22c55e'] }]
  };

  public chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#64748b' } }
    }
  };

  constructor(private service: TransacaoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const theme = localStorage.getItem('theme');
    this.isDarkMode = theme === 'dark';
    if (this.isDarkMode) document.body.classList.add('dark-mode');
    this.carregarDados();
  }

  carregarDados() {
    this.service.listar().subscribe({
      next: (dados: any[]) => {
        this.listaTransacoes = dados.map(d => ({
          ...d, 
          valor: typeof d.valor === 'string' ? parseFloat(d.valor.replace(',', '.')) : Number(d.valor) || 0
        }));
        this.filtrarTransacoes();
      }
    });
  }

  filtrarTransacoes() {
    const termo = this.termoBusca.toLowerCase().trim();
    this.transacoesFiltradas = this.listaTransacoes.filter(t => {
      const data = new Date(t.dataHora || t.data);
      const batePeriodo = data.getMonth() === Number(this.mesSelecionado) && data.getFullYear() === Number(this.anoSelecionado);
      const bateBusca = !termo || t.descricao?.toLowerCase().includes(termo) || t.classificacao?.toLowerCase().includes(termo);
      return batePeriodo && bateBusca;
    });
    this.atualizarMetricas(this.transacoesFiltradas);
    this.gerarGraficos();
  }

  private atualizarMetricas(dados: Transacao[]) {
    this.totalEntradas = dados.filter(t => t.tipo === 'ENTRADA').reduce((acc, t) => acc + t.valor, 0);
    this.totalSaidas = dados.filter(t => t.tipo === 'SAIDA').reduce((acc, t) => acc + t.valor, 0);
    this.saldoAtual = this.totalEntradas - this.totalSaidas;
    this.percentualGasto = this.totalEntradas > 0 ? (this.totalSaidas / this.totalEntradas) * 100 : 0;
  }

  private gerarGraficos() {
    // 1. Barras Anuais (Saídas)
    const valoresAnuais = new Array(12).fill(0);
    this.listaTransacoes.forEach(t => {
      if (t.tipo === 'SAIDA') {
        const d = new Date(t.dataHora || t.data);
        if (d.getFullYear() === Number(this.anoSelecionado)) valoresAnuais[d.getMonth()] += t.valor;
      }
    });
    this.barChartData = { ...this.barChartData, datasets: [{ ...this.barChartData.datasets[0], data: valoresAnuais }] };

    // 2. Evolução de Saldo (Linha) - Ordenação Corrigida
    let saldoAcumulado = 0;
    const labelsEvolucao: string[] = [];
    const dadosEvolucao: number[] = [];
    
    // Ordena do mais antigo para o mais novo antes de calcular o saldo
    const ordenadas = [...this.transacoesFiltradas].sort((a, b) => 
      new Date(a.dataHora || a.data).getTime() - new Date(b.dataHora || b.data).getTime()
    );

    ordenadas.forEach(t => {
      saldoAcumulado += (t.tipo === 'ENTRADA' ? t.valor : -t.valor);
      labelsEvolucao.push(new Date(t.dataHora || t.data).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}));
      dadosEvolucao.push(saldoAcumulado);
    });
    this.lineChartData = { labels: labelsEvolucao, datasets: [{ ...this.lineChartData.datasets[0], data: dadosEvolucao }] };

    // 3. Fixa vs Variável (Pizza)
    const fixa = this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA' && t.classificacao === 'FIXA').reduce((acc, t) => acc + t.valor, 0);
    const variavel = this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA' && t.classificacao === 'VARIAVEL').reduce((acc, t) => acc + t.valor, 0);
    this.categoryPieData = { labels: ['Fixa', 'Variável'], datasets: [{ ...this.categoryPieData.datasets[0], data: [fixa, variavel] }] };

    // 4. Saídas por Descrição (Rosca)
    const agrupadoDesc: { [key: string]: number } = {};
    this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA').forEach(t => {
      const desc = t.descricao.toUpperCase();
      agrupadoDesc[desc] = (agrupadoDesc[desc] || 0) + t.valor;
    });
    this.descriptionPieData = { labels: Object.keys(agrupadoDesc), datasets: [{ ...this.descriptionPieData.datasets[0], data: Object.values(agrupadoDesc) }] };

    this.renderizarGraficos();
  }

  private renderizarGraficos() {
    this.cdr.detectChanges();
    const color = this.isDarkMode ? '#cbd5e1' : '#64748b';
    this.charts?.forEach(chart => {
      if (chart.options?.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = color;
      chart.update();
    });
  }

  formatarMoeda(event: any) {
    let v = event.target.value.replace(/\D/g, '');
    if (!v) { this.gastoForm.get('valor')?.setValue('', { emitEvent: false }); return; }
    const valorNum = (Number(v) / 100);
    const formatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    this.gastoForm.get('valor')?.setValue(formatado, { emitEvent: false });
    event.target.value = formatado;
  }

  salvarGasto() {
    if (this.gastoForm.valid) {
      const formValues = this.gastoForm.getRawValue();
      const valorLimpo = Number(formValues.valor.replace(/[^\d]/g, '')) / 100;
      const payload: Transacao = {
        descricao: formValues.descricao,
        data: formValues.data,
        tipo: formValues.tipo as 'ENTRADA' | 'SAIDA',
        classificacao: formValues.classificacao as 'FIXA' | 'VARIAVEL',
        valor: valorLimpo
      };

      this.service.salvar(payload).subscribe({
        next: () => {
          this.exibirSucesso = true;
          this.gastoForm.reset({ data: new Date().toISOString().substring(0, 10) });
          this.carregarDados();
          setTimeout(() => this.exibirSucesso = false, 3000);
        }
      });
    }
  }

  excluirTransacao(id: any) {
    if (confirm('Deseja realmente excluir esta transação?')) {
      this.service.deletar(id).subscribe({ next: () => this.carregarDados() });
    }
  }

  // Função essencial para evitar erro no template
  trackById(index: number, item: any) {
    return item.id;
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    setTimeout(() => this.renderizarGraficos(), 100);
  }

  exportarPDF() {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['DATA', 'DESCRIÇÃO', 'CATEGORIA', 'TIPO', 'VALOR']],
      body: this.transacoesFiltradas.map(t => [
        new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'),
        t.descricao.toUpperCase(), t.classificacao, t.tipo,
        t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]),
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`extrato_${new Date().getTime()}.pdf`);
  }
}