import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { HashLocationStrategy, LocationStrategy, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { AppComponent } from './app.component';
import { ProdutividadeModule } from './produtividade/produtividade.module';
import { ArquivosModule } from './arquivos/arquivos.module';
import { ConfigModule } from './config/config.module';
import { ReviewQueueModule } from './review-queue/review-queue.module';
import { WorkmonitorModule } from './workmonitor/workmonitor.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { AuthModule } from './auth/auth.module';
import { AuthInterceptor } from './auth/data-access/auth.interceptor';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ResetSenhaModule } from './reset-senha/reset-senha.module';

registerLocaleData(localePt);

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    AuthModule,
    ProdutividadeModule,
    ArquivosModule,
    ConfigModule,
    ReviewQueueModule,
    WorkmonitorModule,
    RelatoriosModule,
    UsuariosModule,
    ResetSenhaModule,
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    // app não usa Angular Router hoje (abas trocam via *ngIf, não rota) — mas
    // sob file:// (Electron) PathLocationStrategy (padrão) quebraria qualquer
    // navegação baseada em URL, então já fica hash-based por precaução/futuro.
    { provide: LocationStrategy, useClass: HashLocationStrategy },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
