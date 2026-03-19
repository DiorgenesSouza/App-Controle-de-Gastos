import { Component, OnInit, ViewChild } from '@angular/core';
import { TransacaoService } from '../services/transacao';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { CommonModule } from '@angular/common'; 
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables } from 'chart.js';
import { ReactiveFormsModule, FormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, ReactiveFormsModule, FormsModule],
  templateUrl: './Dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  
  // Referência para os gráficos
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  // 1. Variáveis de Estado
  listaTransacoes: any[] = []; 
  transacoesFiltradas: any[] = []; 
  termoBusca: string = '';
  saldoAtual: number = 0;
  exibirSucesso: boolean = false;

  // 2. Definição do Formulário
  gastoForm = new FormGroup({
    descricao: new FormControl('', [Validators.required]),
    valor: new FormControl(null, [Validators.required, Validators.min(0.01)]),
    data: new FormControl('', [Validators.required]),
    tipo: new FormControl('', [Validators.required]),
    classificacao: new FormControl('', [Validators.required])
  });

  // 3. Configuração do Gráfico de Barras
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      { 
        data: [], 
        label: 'Gastos (R$)', 
        backgroundColor: '#3498db',
        borderColor: '#2980b9',
        borderWidth: 1
      }
    ]
  };

  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  };

  // 4. Configuração do Gráfico de Pizza (Novo)
  public pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Fixa', 'Variável'],
    datasets: [{
      data: [0, 0],
      backgroundColor: ['#3498db', '#f1c40f'], // Azul para Fixa, Amarelo para Variável
      hoverBackgroundColor: ['#2980b9', '#f39c12']
    }]
  };

  public pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  constructor(private service: TransacaoService) {}

  ngOnInit(): void {
    this.carregarDados();
  }

  // --- FUNÇÕES DE DADOS ---

  carregarDados() {
    this.service.listar().subscribe({
      next: (dados) => {
        this.listaTransacoes = dados;
        this.transacoesFiltradas = dados;
        this.gerarGraficoMensal();
        this.gerarGraficoPizza(); // Atualiza a pizza ao carregar dados
      },
      error: (err) => console.error('Erro ao buscar transações:', err)
    });

    this.service.obterSaldo().subscribe({
      next: (s) => this.saldoAtual = s,
      error: (err) => console.error('Erro ao buscar saldo:', err)
    });
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
        error: (err) => alert('Erro ao salvar no servidor!')
      });
    }
  }

  excluirTransacao(id: number) {
    if (confirm('Deseja realmente excluir este lançamento?')) {
      this.service.deletar(id).subscribe({
        next: () => this.carregarDados(),
        error: (err) => alert('Erro ao excluir!')
      });
    }
  }

  // --- LÓGICA DOS GRÁFICOS ---

  gerarGraficoPizza() {
    let totalFixa = 0;
    let totalVariavel = 0;

    this.listaTransacoes.forEach(t => {
      if (t.tipo === 'SAIDA') {
        if (t.classificacao === 'FIXA') totalFixa += t.valor;
        if (t.classificacao === 'VARIAVEL') totalVariavel += t.valor;
      }
    });

    this.pieChartData = {
      ...this.pieChartData,
      datasets: [{
        ...this.pieChartData.datasets[0],
        data: [totalFixa, totalVariavel]
      }]
    };
  }

  gerarGraficoMensal() {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const valores = new Array(12).fill(0);

    this.listaTransacoes.forEach(t => {
      if (t.tipo?.toUpperCase() === 'SAIDA') {
        const mes = new Date(t.dataHora || t.data).getMonth();
        valores[mes] += t.valor;
      }
    });

    this.atualizarGraficoBarras(meses, valores, 'Gastos por Mês (R$)');
  }

  gerarGraficoDiario() {
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const labelsDias: string[] = [];
    const valores = new Array(7).fill(0);
    const hoje = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(hoje.getDate() - i);
      labelsDias.push(diasSemana[d.getDay()]);
    }

    this.listaTransacoes.forEach(t => {
      if (t.tipo?.toUpperCase() === 'SAIDA') {
        const dataT = new Date(t.dataHora || t.data);
        const diffDays = Math.floor((hoje.getTime() - dataT.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) valores[6 - diffDays] += t.valor;
      }
    });

    this.atualizarGraficoBarras(labelsDias, valores, 'Últimos 7 Dias (R$)');
  }

  private atualizarGraficoBarras(labels: string[], dados: number[], labelDataset: string) {
    this.barChartData = {
      labels: labels,
      datasets: [{ ...this.barChartData.datasets[0], data: dados, label: labelDataset }]
    };
  }

  // --- FILTROS E UTILITÁRIOS ---

  filtrarTransacoes() {
    this.transacoesFiltradas = this.listaTransacoes.filter(t => 
      t.descricao?.toLowerCase().includes(this.termoBusca.toLowerCase())
    );
  }

  formatarMoeda(event: any) {
    let valor = event.target.value.replace(/\D/g, '');
    const valorNumerico = Number(valor) / 100;
    event.target.value = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    this.gastoForm.get('valor')!.setValue(valorNumerico as any, { emitEvent: false });
  }
}