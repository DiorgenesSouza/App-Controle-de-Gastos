import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app'; // ajuste se o caminho for './app/app.component'
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app-routing-module'; // ajuste o caminho das suas rotas

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideRouter(routes)
  ]
}).catch(err => console.error(err));