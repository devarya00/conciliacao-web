import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RelatoriosPageComponent } from './relatorios-page.component';

@NgModule({
  declarations: [RelatoriosPageComponent],
  imports: [CommonModule, FormsModule],
  exports: [RelatoriosPageComponent],
})
export class RelatoriosModule {}
