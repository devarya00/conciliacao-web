import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArquivosPageComponent } from './arquivos-page.component';

@NgModule({
  declarations: [ArquivosPageComponent],
  imports: [CommonModule, FormsModule],
  exports: [ArquivosPageComponent],
})
export class ArquivosModule {}
