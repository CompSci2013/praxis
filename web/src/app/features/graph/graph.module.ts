import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgxGraphModule } from '@swimlane/ngx-graph';
import { GraphViewComponent } from './graph-view/graph-view.component';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectButtonModule } from 'primeng/selectbutton';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { SliderModule } from 'primeng/slider';
import { ToolbarModule } from 'primeng/toolbar';
import { PanelModule } from 'primeng/panel';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';

const routes: Routes = [
  { path: '', component: GraphViewComponent }
];

@NgModule({
  declarations: [GraphViewComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    NgxGraphModule,
    ButtonModule,
    MultiSelectModule,
    SelectButtonModule,
    AutoCompleteModule,
    SliderModule,
    ToolbarModule,
    PanelModule,
    TooltipModule,
    CheckboxModule,
  ],
})
export class GraphModule {}
