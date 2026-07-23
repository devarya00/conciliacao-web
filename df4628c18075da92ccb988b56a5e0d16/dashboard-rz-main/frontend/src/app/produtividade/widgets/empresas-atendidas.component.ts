import { Component, Input } from '@angular/core';
import { EmpresaAtendida } from '../models/dashboard.model';

@Component({
  selector: 'app-empresas-atendidas',
  templateUrl: './empresas-atendidas.component.html',
  styleUrls: ['./empresas-atendidas.component.scss'],
})
export class EmpresasAtendidasComponent {
  @Input() empresas: EmpresaAtendida[] = [];
}
