import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RelatoriosPageComponent } from './relatorios-page.component';
import { ConferenciaChecklistComponent } from './widgets/conferencia-checklist.component';

@NgModule({
  declarations: [RelatoriosPageComponent, ConferenciaChecklistComponent],
  imports: [CommonModule, FormsModule],
  exports: [RelatoriosPageComponent],
})
export class RelatoriosModule {}
