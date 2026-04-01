import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing-module';
import { AppComponent } from './app';
import { DashboardComponent } from './Dashboard/DashboardComponent'; 

@NgModule({
  declarations: [
    // Se o seu Login não for standalone, ele entra aqui
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CommonModule,
    AppComponent,
    DashboardComponent
  ],
  providers: [
    provideHttpClient()
  ]
})
export class AppModule { }