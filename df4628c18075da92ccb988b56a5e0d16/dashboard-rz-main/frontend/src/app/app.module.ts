import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
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
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
