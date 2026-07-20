import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigPageComponent } from './config-page.component';

@NgModule({
  declarations: [ConfigPageComponent],
  imports: [CommonModule, FormsModule],
  exports: [ConfigPageComponent],
})
export class ConfigModule {}
