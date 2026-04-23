import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-severity-badge',
  templateUrl: './severity-badge.component.html',
  styleUrls: ['./severity-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeverityBadgeComponent {
  @Input() severity = '';

  get severityClass(): string {
    switch (this.severity) {
      case 'critical': return 'danger';
      case 'important': return 'warning';
      case 'recommended': return 'info';
      case 'informational': return 'secondary';
      default: return 'info';
    }
  }

  get label(): string {
    return this.severity ? this.severity.charAt(0).toUpperCase() + this.severity.slice(1) : '';
  }
}
