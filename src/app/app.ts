import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './Dashboard/DashboardComponent';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent,RouterModule], // Importante para o <app-dashboard> funcionar
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent { }