import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './Dashboard/DashboardComponent'; 
import { LoginComponent } from './components/login/login';

export const routes: Routes = [
  // 1. Rota de Login
  { path: 'login', component: LoginComponent },
  
  // 2. Rota do Painel
  { path: 'dashboard', component: DashboardComponent },
  
  // 3. Quando abrir o site (caminho vazio), vai para o login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // 4. Qualquer outra coisa, manda para o login
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }