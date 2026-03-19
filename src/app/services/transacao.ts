import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TransacaoService {
  // URL da sua API Java que já está rodando
  private readonly API = 'http://localhost:8080/api/transacoes';

  constructor(private http: HttpClient) {}

  listar(): Observable<any[]> {
    return this.http.get<any[]>(this.API);
  }

  obterSaldo(): Observable<number> {
    return this.http.get<number>(`${this.API}/saldo`);
  }

  // No transacao.ts
salvar(transacao: any): Observable<any> {
  // Ajuste a URL para o seu endpoint do Spring Boot (ex: /api/transacoes)
  return this.http.post('http://localhost:8080/api/transacoes', transacao);
}
}