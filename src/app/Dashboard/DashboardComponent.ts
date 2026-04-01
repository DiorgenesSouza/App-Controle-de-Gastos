import { Router } from '@angular/router';
import { Component, OnInit, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { TransacaoService } from '../services/transacao';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
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
  @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;
  

  // Variáveis de Estado
  listaTransacoes: any[] = [];
  transacoesFiltradas: any[] = [];
  idEmEdicao: number | null = null;
  isDarkMode: boolean = false;
  saldoAtual: number = 0;
  totalEntradas: number = 0;
  totalSaidas: number = 0;
  percentualGasto: number = 0;
  metaMensal: number = 1500;

  // Filtros
  mesSelecionado: number = new Date().getMonth();
  anoSelecionado: number = 2026;
  termoBusca: string = '';

  // Formulário (O que estava faltando para o HTML não dar erro)
  gastoForm: FormGroup = new FormGroup({
    descricao: new FormControl('', Validators.required),
    valor: new FormControl('', Validators.required),
    data: new FormControl(new Date().toISOString().split('T')[0], Validators.required),
    tipo: new FormControl('', Validators.required),
    classificacao: new FormControl('', Validators.required)
  });

  // Configurações de Dados dos 4 Gráficos
  public barChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [{ data: [], label: 'Gastos (R$)', backgroundColor: '#ef4444' }] };
  public lineChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [{ data: [], label: 'Saldo Acumulado (R$)', borderColor: '#22c55e', fill: true }] };
  public pieChartData: ChartConfiguration<'pie'>['data'] = { labels: ['Fixa', 'Variável'], datasets: [{ data: [], backgroundColor: ['#f59e0b', '#8b5cf6'] }] };
  public doughnutChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [{ data: [], backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'] }] };

  public chartOptions: ChartOptions = { 
    responsive: true, 
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8' } } } 
  };

  constructor(
    private service: TransacaoService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() { this.carregarDados(); }

  // Alternar Tema
  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    // Força a atualização das cores dos gráficos se necessário
    this.gerarGraficos();
  }

  carregarDados() {
    this.service.listar().subscribe(dados => {
      this.listaTransacoes = dados;
      this.filtrarTransacoes();
    });
  }

  filtrarTransacoes() {
  this.transacoesFiltradas = this.listaTransacoes.filter(t => {
    const dataT = new Date(t.dataHora || t.data);
    
    // Se mesSelecionado for -1, bateMes será sempre true (ignora o filtro de mês)
    // Se mesSelecionado for 0 (Todos os Meses), bateMes será sempre true
   const mesAlvo = Number(this.mesSelecionado);
    const bateMes = mesAlvo === 0 || dataT.getMonth() === (mesAlvo - 1);
    
    // Adicione esta linha abaixo que estava faltando:
    const bateAno = dataT.getFullYear() === Number(this.anoSelecionado);
    
    const bateBusca = t.descricao.toLowerCase().includes(this.termoBusca.toLowerCase());
    
    return bateMes && bateAno && bateBusca;
  });

  this.atualizarMetricas();
  this.gerarGraficos();
}

  atualizarMetricas() {
    this.totalEntradas = this.transacoesFiltradas.filter(t => t.tipo === 'ENTRADA').reduce((a, b) => a + b.valor, 0);
    this.totalSaidas = this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA').reduce((a, b) => a + b.valor, 0);
    this.saldoAtual = this.totalEntradas - this.totalSaidas;
    this.percentualGasto = (this.totalSaidas / this.metaMensal) * 100;
  }

 salvarGasto() {
  if (this.gastoForm.valid) {
    let dados = { ...this.gastoForm.value };
    
    // Converte a string "R$ 10,00" para o número 10.00 que o Java espera
    if (typeof dados.valor === 'string') {
      dados.valor = parseFloat(dados.valor.replace('R$', '').replace(/\./g, '').replace(',', '.'));
    }

    if (this.idEmEdicao) {
      // Se existe um ID guardado, chama o EDITAR (PUT)
      this.service.editar(this.idEmEdicao, dados).subscribe(() => this.posSalvar());
    } else {
      // Se não tem ID, chama o SALVAR comum (POST)
      this.service.salvar(dados).subscribe(() => this.posSalvar());
    }
  }
}

// Função para limpar tudo após o sucesso
posSalvar() {
  this.idEmEdicao = null;
  this.gastoForm.reset({ data: new Date().toISOString().split('T')[0] });
  this.carregarDados();
}

// Criamos essa função auxiliar para não repetir código
finalizarAcao() {
  this.idEmEdicao = null; // Limpa o ID de edição
  this.gastoForm.reset({ 
    data: new Date().toISOString().split('T')[0],
    descricao: '', valor: '', tipo: '', classificacao: ''
  });
  this.carregarDados();
}

  excluirTransacao(id: number) {
    if(confirm('Deseja excluir este lançamento?')) {
      this.service.excluir(id).subscribe(() => this.carregarDados());
    }
  }

  logout() {
  if (confirm('Deseja realmente sair do sistema?')) {
    // 1. Limpa dados de sessão (se houver)
    localStorage.clear();
    sessionStorage.clear();

    console.log('Sessão encerrada.');

    // 2. Redireciona para a tela de login
    // Certifique-se de que a rota no seu app.routes.ts seja 'login'
    this.router.navigate(['/login']);
  }
}


  editarTransacao(t: any) {
  this.gastoForm.patchValue({
    descricao: t.descricao,
    valor: t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    tipo: t.tipo,
    classificacao: t.classificacao,
    data: new Date(t.dataHora || t.data).toISOString().split('T')[0]
  });
  
  this.idEmEdicao = t.id; // Isso avisa o sistema que a próxima gravação é uma edição
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


  formatarMoeda(event: any) {
    let v = event.target.value.replace(/\D/g, '');
    v = (Number(v) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    this.gastoForm.patchValue({ valor: v }, { emitEvent: false });
  }

  gerarGraficos() {
  // --- 1. EVOLUÇÃO DO SALDO (Gráfico de Linha) ---
  // Ordena todas as transações por data para a linha fazer sentido
  const transacoesOrdenadas = [...this.transacoesFiltradas].sort((a, b) => 
    new Date(a.dataHora || a.data).getTime() - new Date(b.dataHora || b.data).getTime()
  );

  let acumulado = 0;
  const labelsEvolucao: string[] = [];
  const dadosEvolucao: number[] = [];

  transacoesOrdenadas.forEach(t => {
    // Soma se for entrada, subtrai se for saída
    acumulado += (t.tipo === 'ENTRADA' ? t.valor : -t.valor);
    labelsEvolucao.push(new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'));
    dadosEvolucao.push(acumulado);
  });

  this.lineChartData.labels = labelsEvolucao;
  this.lineChartData.datasets[0].data = dadosEvolucao;

  // --- 2. PIZZA: Fixa vs Variável ---
  const fixas = this.transacoesFiltradas.filter(t => t.classificacao === 'FIXA').length;
  const variaveis = this.transacoesFiltradas.filter(t => t.classificacao === 'VARIAVEL').length;
  this.pieChartData.datasets[0].data = [fixas, variaveis];

  // --- 3. ROSCA: Saídas por Descrição ---
  const saidas = this.transacoesFiltradas.filter(t => t.tipo === 'SAIDA');
  const labelsSaidas = [...new Set(saidas.map(s => s.descricao))];
  this.doughnutChartData.labels = labelsSaidas;
  this.doughnutChartData.datasets[0].data = labelsSaidas.map(l => 
    saidas.filter(s => s.descricao === l).reduce((a, b) => a + b.valor, 0)
  );

  // --- 4. BARRAS: Gastos Totais ---
 this.barChartData.labels = [this.mesSelecionado == -1 ? 'Todos os Meses' : this.obterNomeMes(this.mesSelecionado)];
 this.barChartData.datasets[0].data = [this.totalSaidas];

  // Força o Angular e o Chart.js a redesenharem os gráficos
  this.cdr.detectChanges();
  this.charts?.forEach(c => c.chart?.update());
}

  exportarPDF() {
    const doc = new jsPDF();
    const rows: any[] = this.transacoesFiltradas.map(t => [
      new Date(t.dataHora || t.data).toLocaleDateString('pt-BR'), 
      t.descricao, 
      t.tipo, 
      t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);
    
    // Correção do erro TS2322 para o PDF
    const totalRow: any = [
      { content: 'SALDO ATUAL:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: this.saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { fontStyle: 'bold' } }
    ];
    rows.push(totalRow);

    autoTable(doc, { 
      head: [['Data', 'Descrição', 'Tipo', 'Valor']], 
      body: rows,
      theme: 'striped'
    });
    doc.save(`extrato_${this.mesSelecionado + 1}_${this.anoSelecionado}.pdf`);
  }

  obterNomeMes(mes: number | string): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return meses[Number(mes)-1];
}
}