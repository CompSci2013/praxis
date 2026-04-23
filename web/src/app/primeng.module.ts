import { NgModule } from '@angular/core';
import { TreeModule } from 'primeng/tree';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ChipModule } from 'primeng/chip';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { TabViewModule } from 'primeng/tabview';
import { SidebarModule } from 'primeng/sidebar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { SplitterModule } from 'primeng/splitter';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { AccordionModule } from 'primeng/accordion';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SliderModule } from 'primeng/slider';

const MODULES = [
  TreeModule,
  PanelModule,
  ButtonModule,
  InputTextModule,
  ChipModule,
  DropdownModule,
  MultiSelectModule,
  ToastModule,
  ToolbarModule,
  TabViewModule,
  SidebarModule,
  BreadcrumbModule,
  TagModule,
  BadgeModule,
  SplitterModule,
  AutoCompleteModule,
  SkeletonModule,
  TooltipModule,
  SelectButtonModule,
  CardModule,
  DividerModule,
  AccordionModule,
  InputSwitchModule,
  SliderModule,
];

@NgModule({
  imports: MODULES,
  exports: MODULES,
})
export class PrimengModule {}
