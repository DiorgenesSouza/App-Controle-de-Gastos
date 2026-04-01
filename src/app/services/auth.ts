import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // CORREÇÃO 1: Adicionada a barra '/' antes do auth
  private apiUrl = 'http://localhost:8080/auth'; 

  constructor(private http: HttpClient) { }

  login(credentials: any): Observable<any> {
    // CORREÇÃO 2: Removido o '/usuarios', usando apenas o que está no seu Controller Java
    return this.http.post(`${this.apiUrl}/login`, credentials, { responseType: 'text' }).pipe(
      tap(token => {
        // Guarda o Token JWT no navegador para usar depois
        localStorage.setItem('token', token);
      })
    );
  }

  // Método para verificar se o usuário está logado
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  // Método para sair do sistema
  logout() {
    localStorage.removeItem('token');
  }
}