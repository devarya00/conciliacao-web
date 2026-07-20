import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewQueuePageComponent } from './review-queue-page.component';

@NgModule({
  declarations: [ReviewQueuePageComponent],
  imports: [CommonModule, FormsModule],
  exports: [ReviewQueuePageComponent],
})
export class ReviewQueueModule {}
