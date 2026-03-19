import { Component, OnInit } from '@angular/core';
import { TransacaoService } from '../services/transacao';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { CommonModule } from '@angular/common'; 
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables } from 'chart.js';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, ReactiveFormsModule],
  templateUrl: './Dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  
  listaTransacoes: any[] = []; // Verifique se o nome está igual ao usado no forEach
  saldoAtual: number = 0;

  gastoForm = new FormGroup({
    descricao: new FormControl('', [Validators.required]),
    valor: new FormControl(null, [Validators.required, Validators.min(0.01)]),
    data: new FormControl('', [Validators.required]),
    tipo: new FormControl('', [Validators.required]),
    classificacao: new FormControl('', [Validators.required])
  });

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

  constructor(private service: TransacaoService) {}

  ngOnInit(): void {
    this.carregarDados();
  }

 // No topo da classe, junto com as outras variáveis
exibirSucesso: boolean = false;

// Atualize sua função salvarGasto
salvarGasto() {
  if (this.gastoForm.valid) {
    const novoGasto = this.gastoForm.value; 

    this.service.salvar(novoGasto).subscribe({
      next: (res) => {
        this.exibirSucesso = true; // Ativa a mensagem
        this.gastoForm.reset();
        this.carregarDados(); 

        // Esconde a mensagem automaticamente após 3 segundos
        setTimeout(() => {
          this.exibirSucesso = false;
        }, 3000);
      },
      error: (err) => {
        console.error('Erro ao salvar:', err);
        alert('Erro ao salvar. Verifique o servidor!');
      }
    });
  }
}

  carregarDados() {
    this.service.listar().subscribe({
      next: (dados) => {
        this.listaTransacoes = dados; // Usei o nome que está na imagem e1d9e5.png
        this.gerarGraficoMensal();
      },
      error: (err) => console.error('Erro ao buscar transações:', err)
    });

    this.service.obterSaldo().subscribe({
      next: (s) => this.saldoAtual = s,
      error: (err) => console.error('Erro ao buscar saldo:', err)
    });
  }

  gerarGraficoMensal() {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const valores = new Array(12).fill(0);

    this.listaTransacoes.forEach(t => {
      if (t.tipo && t.tipo.toUpperCase() === 'SAIDA') {
        const dataTransacao = new Date(t.dataHora || t.data);
        const mes = dataTransacao.getMonth();
        valores[mes] += t.valor;
      }
    });

    this.atualizarGrafico(meses, valores, 'Gastos por Mês (R$)');
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
      if (t.tipo && t.tipo.toUpperCase() === 'SAIDA') {
        const dataT = new Date(t.dataHora || t.data);
        const diffTime = hoje.getTime() - dataT.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < 7) {
          valores[6 - diffDays] += t.valor;
        }
      }
    });

    this.atualizarGrafico(labelsDias, valores, 'Gastos nos Últimos 7 Dias (R$)');
  }

  private atualizarGrafico(labels: string[], dados: number[], labelDataset: string) {
    this.barChartData = {
      labels: labels,
      datasets: [
        { ...this.barChartData.datasets[0], data: dados, label: labelDataset }
      ]
    };
  }

  formatarMoeda(event: any) {
    let valor = event.target.value.replace(/\D/g, '');
    const valorNumerico = Number(valor) / 100;

    event.target.value = valorNumerico.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    // O '!' resolve o erro da imagem e2375f.png
    this.gastoForm.get('valor')!.setValue(valorNumerico as any, { emitEvent: false });
  }
}