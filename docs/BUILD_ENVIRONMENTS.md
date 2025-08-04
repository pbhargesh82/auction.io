# Build Environments Guide

This document explains the different build environments available in the Auction.io project and how to use them.

## Available Environments

### 1. Development Environment
- **Purpose**: Local development and testing
- **Features**: 
  - Debug mode enabled
  - Source maps enabled
  - No optimization
  - Local Supabase connection
  - Localhost redirect URLs
- **Build Command**: `ng build --configuration development`
- **Serve Command**: `ng serve` (defaults to development)
- **Environment File**: `src/environments/environment.ts`

### 2. Production Environment
- **Purpose**: Production deployment
- **Features**:
  - Full optimization enabled
  - Source maps disabled
  - License extraction enabled
  - Production Supabase connection
  - Production redirect URLs
  - Analytics enabled
- **Build Command**: `ng build --configuration production`
- **Serve Command**: `ng serve --configuration production`
- **Environment File**: `src/environments/environment.prod.ts`

## Environment Configuration

### Environment Files

#### Development (`src/environments/environment.ts`)
```typescript
export const environment = {
  production: false,
  development: true,
  version: '1.0.0',
  supabase: {
    url: 'https://mcceuswycjpcsgseaixg.supabase.co',
    anonKey: 'your-anon-key'
  },
  auth: {
    redirectUrl: 'http://localhost:4200/auth/callback'
  },
  features: {
    enableAnalytics: false,
    enableRealtime: true,
    enableDebugMode: true
  }
};
```

#### Production (`src/environments/environment.prod.ts`)
```typescript
export const environment = {
  production: true,
  version: '1.0.0',
  supabase: {
    url: 'https://mcceuswycjpcsgseaixg.supabase.co',
    anonKey: 'your-anon-key'
  },
  auth: {
    redirectUrl: 'https://auction-io.netlify.app/auth/callback'
  },
  features: {
    enableAnalytics: true,
    enableRealtime: true,
    enableDebugMode: false
  }
};
```

### Angular Configuration (`angular.json`)

The build configurations are defined in `angular.json`:

```json
{
  "configurations": {
    "production": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.prod.ts"
        }
      ],
      "budgets": [
        {
          "type": "initial",
          "maximumWarning": "1MB",
          "maximumError": "2MB"
        }
      ],
      "outputHashing": "all",
      "optimization": true,
      "extractLicenses": true,
      "sourceMap": false
    },
    "development": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.ts"
        }
      ],
      "optimization": false,
      "extractLicenses": false,
      "sourceMap": true
    }
  }
}
```

## Build Commands

### Package.json Scripts
```json
{
  "scripts": {
    "start": "ng serve",
    "build": "ng build --configuration production",
    "watch": "ng build --watch --configuration development"
  }
}
```

### Manual Commands
```bash
# Development
ng serve
ng build --configuration development

# Production
ng build --configuration production
ng serve --configuration production
```

## Netlify Integration

### Netlify Configuration (`netlify.toml`)
```toml
[build]
  publish = "dist/auction.io/browser"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[dev]
  command = "npm start"
  port = 4200
  publish = "dist/auction.io/browser"
```

### Environment Variables
- **Production**: Uses production environment file automatically
- **Development**: Uses development environment file for local development

## Environment Variables

### Development
- `NODE_ENV`: development
- `SUPABASE_URL`: Development Supabase instance
- `SUPABASE_ANON_KEY`: Development API key

### Production
- `NODE_ENV`: production
- `SUPABASE_URL`: Production Supabase instance
- `SUPABASE_ANON_KEY`: Production API key

## Feature Flags

Feature flags are controlled through the `features` object in environment files:

```typescript
features: {
  enableAnalytics: boolean,    // Enable/disable analytics
  enableRealtime: boolean,     // Enable/disable real-time features
  enableDebugMode: boolean     // Enable/disable debug mode
}
```

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to version control
2. **API Keys**: Use different API keys for development and production
3. **Redirect URLs**: Ensure redirect URLs match the deployment environment
4. **Feature Flags**: Use feature flags to control sensitive features

## Monitoring and Debugging

### Development
- Source maps enabled for debugging
- Console logging available
- Debug mode enabled

### Production
- Source maps disabled for performance
- Minimal console logging
- Analytics enabled for monitoring

## Troubleshooting

### Common Issues

1. **Build Fails**: Check if all environment variables are set
2. **Wrong Environment**: Verify the correct configuration is being used
3. **API Errors**: Ensure Supabase credentials match the environment

### Debug Commands
```bash
# Check current environment
echo $NODE_ENV

# Verify build configuration
ng build --configuration production --verbose

# Check environment file replacement
ng build --configuration production --dry-run
```

## Best Practices

1. **Environment Separation**: Always use different configurations for dev and prod
2. **Feature Flags**: Use feature flags to control environment-specific features
3. **Security**: Never expose production credentials in development
4. **Testing**: Test both environments before deployment
5. **Documentation**: Keep environment configuration documented

## Adding New Environments

To add a new environment:

1. Create a new environment file (`src/environments/environment.{env}.ts`)
2. Add configuration to `angular.json`
3. Update build scripts in `package.json`
4. Configure Netlify contexts if needed
5. Update this documentation

## Version Management

Environment files include version information that can be used for:
- Feature toggling based on version
- Deprecation warnings
- Compatibility checks

The version is automatically updated using the `update-version.js` script. 