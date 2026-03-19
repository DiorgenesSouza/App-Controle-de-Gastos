import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TransacaoService {
  
  // URL centralizada da sua API Java
  private readonly API = 'http://localhost:8080/api/transacoes';

  constructor(private http: HttpClient) {}

  // Busca todas as transações
  listar(): Observable<any[]> {
    return this.http.get<any[]>(this.API);
  }

  // Busca o saldo atualizado do banco
  obterSaldo(): Observable<number> {
    return this.http.get<number>(`${this.API}/saldo`);
  }

  // Envia um novo gasto/entrada para o Java
  salvar(transacao: any): Observable<any> {
    return this.http.post<any>(this.API, transacao);
  }

  // Remove uma transação pelo ID (Corrigido de 'url' para 'API')
  deletar(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API}/${id}`);
  }
}