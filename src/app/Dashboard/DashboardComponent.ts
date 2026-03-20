import { Component, OnInit, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { TransacaoService } from '../services/transacao';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
import { CommonModule } from '@angular/common'; 
import { BaseChartDirective } from 'ng2-charts';
import { ReactiveFormsModule, FormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import jsPDF from 'jspdf';
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
  isDarkMode: boolean = false;
  mesSelecionado: number = new Date().getMonth();
  anoSelecionado: number = new Date().getFullYear();
  exibirSucesso: boolean = false;
  
  // Métricas e Metas
  saldoAtual: number = 0;
  totalEntradas: number = 0;
  totalSaidas: number = 0;
  percentualGasto: number = 0;
  metaMensal: number = 3000; 
  statusMeta: 'seguro' | 'alerta' | 'perigo' = 'seguro';

  gastoForm = new FormGroup({
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    valor: new FormControl('', { nonNullable: true, validators: [Validators.required] }), 
    data: new FormControl(new Date().toISOString().substring(0, 10), { nonNullable: true, validators: [Validators.required] }),
    tipo: new FormControl<'ENTRADA' | 'SAIDA' | ''>('', { nonNullable: true, validators: [Validators.required] }),
    classificacao: new FormControl<'FIXA' | 'VARIAVEL' | ''>('', { nonNullable: true, validators: [Validators.required] })
  });

  /* Configurações de Gráficos */
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    datasets: [{ data: [], label: 'Gastos (R$)', backgroundColor: '#ef4444' }]
  };

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Saldo Acumulado (R$)', borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.3 }]
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
    plugins: { legend: { labels: { color: '#64748b' } } }
  };

  constructor(private service: TransacaoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.isDarkMode = localStorage.getItem('theme') === 'dark';
    if (this.isDarkMode) document.body.classList.add('dark-mode');
    this.carregarDados();
  }

  carregarDados() {
    this.service.listar().subscribe({
      next: (dados: any[]) => {
        this.listaTransacoes = dados.map(d => ({
          ...d, 
          valor: typeof d.valor === 'string' ? parseFloat(d.valor.replace(/[^\d,]/g, '').replace(',', '.')) : Number(d.valor) || 0
        }));
        this.filtrarTransacoes();
      }
    });
  }

  filtrarTransacoes() {
    this.transacoesFiltradas = this.listaTransacoes.filter(t => {
      const data = new Date(t.dataHora || t.data);
      const batePeriodo = data.getMonth() === Number(this.mesSelecionado) && data.getFullYear() === Number(this.anoSelecionado);
      const bateBusca = !this.termoBusca || t.descricao?.toLowerCase().includes(this.termoBusca.toLowerCase());
      return batePeriodo && bateBusca;
    });
    this.atualizarMetricas();
    this.gerarGraficos();
  }

  private atualizarMetricas() {
    this.totalEntradas = this.transacoesFiltradas.filter(t => t.tipo === 'ENTRADA').reduce((acc, t) => acc + t.valor, 0);
    this.totalSaidas = this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA').reduce((acc, t) => acc + t.valor, 0);
    this.saldoAtual = this.totalEntradas - this.totalSaidas;
    
    this.percentualGasto = (this.totalSaidas / this.metaMensal) * 100;
    this.statusMeta = this.percentualGasto >= 100 ? 'perigo' : (this.percentualGasto >= 80 ? 'alerta' : 'seguro');
  }

  private gerarGraficos() {
    // 1. Gráfico de Barras: Soma todas as SAIDAS do ano selecionado
    const gastosMesAMes = new Array(12).fill(0);
    this.listaTransacoes.forEach(t => {
      const data = new Date(t.dataHora || t.data);
      if (t.tipo === 'SAIDA' && data.getFullYear() === Number(this.anoSelecionado)) {
        gastosMesAMes[data.getMonth()] += t.valor;
      }
    });
    this.barChartData = { ...this.barChartData, datasets: [{ ...this.barChartData.datasets[0], data: gastosMesAMes }] };

    // 2. Gráfico de Linha: Evolução do saldo no mês filtrado
    let acumulado = 0;
    const ordenadas = [...this.transacoesFiltradas].sort((a, b) => new Date(a.dataHora || a.data).getTime() - new Date(b.dataHora || b.data).getTime());
    const labelsLinha = ordenadas.map(t => new Date(t.dataHora || t.data).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}));
    const valoresLinha = ordenadas.map(t => {
      acumulado += (t.tipo === 'ENTRADA' ? t.valor : -t.valor);
      return acumulado;
    });
    this.lineChartData = { labels: labelsLinha, datasets: [{ ...this.lineChartData.datasets[0], data: valoresLinha }] };
    
    // 3. Gráfico de Pizza: Fixa vs Variável (Saídas do mês)
    const fixa = this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA' && t.classificacao === 'FIXA').reduce((acc, t) => acc + t.valor, 0);
    const variavel = this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA' && t.classificacao === 'VARIAVEL').reduce((acc, t) => acc + t.valor, 0);
    this.categoryPieData = { labels: ['Fixa', 'Variável'], datasets: [{ ...this.categoryPieData.datasets[0], data: [fixa, variavel] }] };

    // 4. Gráfico de Rosca: Saídas por Descrição
    const agrupado: any = {};
    this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA').forEach(t => {
      agrupado[t.descricao] = (agrupado[t.descricao] || 0) + t.valor;
    });
    this.descriptionPieData = { 
      labels: Object.keys(agrupado), 
      datasets: [{ ...this.descriptionPieData.datasets[0], data: Object.values(agrupado) }] 
    };

    this.renderizarGraficos();
  }

  private renderizarGraficos() {
    this.cdr.detectChanges();
    this.charts?.forEach(c => c.update());
  }

  salvarGasto() {
    if (this.gastoForm.valid) {
      const raw = this.gastoForm.getRawValue();
      const valorLimpo = typeof raw.valor === 'string' 
        ? parseFloat(raw.valor.replace(/[^\d,]/g, '').replace(',', '.')) 
        : raw.valor;

      const dados = { ...raw, valor: valorLimpo };

      this.service.salvar(dados).subscribe({
        next: () => {
          this.exibirSucesso = true;
          this.gastoForm.reset({ data: new Date().toISOString().substring(0, 10), tipo: '', classificacao: '' });
          this.carregarDados();
          setTimeout(() => this.exibirSucesso = false, 3000);
        }
      });
    }
  }

  // Corrigido para bater com o erro do terminal: certifique-se que no Service o método se chama 'deletar'
  excluirTransacao(id: any) {
    if (confirm('Deseja realmente excluir este lançamento?')) {
      this.service.deletar(id).subscribe({
        next: () => this.carregarDados(),
        error: (err) => console.error('Erro ao excluir:', err)
      });
    }
  }

  formatarMoeda(event: any) {
    let v = event.target.value.replace(/\D/g, '');
    v = (Number(v) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    this.gastoForm.patchValue({ valor: v });
  }

  exportarPDF() {
    const doc = new jsPDF();
    doc.text('Extrato de Lançamentos', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Data', 'Descrição', 'Tipo', 'Valor']],
      body: this.transacoesFiltradas.map(t => [
        new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'),
        t.descricao,
        t.tipo,
        t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]),
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`extrato_${new Date().getTime()}.pdf`);
  }

  trackById(index: number, item: any) { return item.id; }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    this.renderizarGraficos();
  }
}