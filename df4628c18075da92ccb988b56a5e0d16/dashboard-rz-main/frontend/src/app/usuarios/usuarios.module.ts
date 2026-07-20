import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosPageComponent } from './usuarios-page.component';

@NgModule({
  declarations: [UsuariosPageComponent],
  imports: [CommonModule, FormsModule],
  exports: [UsuariosPageComponent],
})
export class UsuariosModule {}
