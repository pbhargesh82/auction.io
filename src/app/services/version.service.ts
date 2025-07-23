import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  
  /**
   * Get the current application version
   * Priority: environment.version > package.json version > fallback
   */
  getVersion(): string {
    // First try to get from environment
    if (environment.version) {
      return environment.version;
    }
    
    // Fallback to a default version
    return '1.0.0';
  }

  /**
   * Get version with 'v' prefix
   */
  getVersionWithPrefix(): string {
    return `v${this.getVersion()}`;
  }

  /**
   * Get short version (first two parts only)
   */
  getShortVersion(): string {
    const version = this.getVersion();
    const parts = version.split('.');
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : version;
  }

  /**
   * Get short version with 'v' prefix
   */
  getShortVersionWithPrefix(): string {
    return `v${this.getShortVersion()}`;
  }

  /**
   * Check if current version is a development version
   */
  isDevelopment(): boolean {
    return !environment.production;
  }

  /**
   * Get build information
   */
  getBuildInfo(): { version: string; environment: string; timestamp: string } {
    return {
      version: this.getVersion(),
      environment: environment.production ? 'production' : 'development',
      timestamp: new Date().toISOString()
    };
  }
} 