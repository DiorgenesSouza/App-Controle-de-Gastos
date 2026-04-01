import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app'; 
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // Adicionado withInterceptors
import { provideRouter } from '@angular/router';
import { routes } from './app/app-routing-module';
import { authInterceptor } from './app/services/auth.interceptor'; // Importe o interceptor que criamos

bootstrapApplication(AppComponent, {
  providers: [
    // Agora o HttpClient sabe que deve usar o seu interceptor em cada requisição
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideRouter(routes)
  ]
}).catch(err => console.error(err));