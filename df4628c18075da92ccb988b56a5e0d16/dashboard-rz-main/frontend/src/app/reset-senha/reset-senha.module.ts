import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResetSenhaComponent } from './reset-senha.component';

@NgModule({
  declarations: [ResetSenhaComponent],
  imports: [CommonModule, FormsModule],
  exports: [ResetSenhaComponent],
})
export class ResetSenhaModule {}
