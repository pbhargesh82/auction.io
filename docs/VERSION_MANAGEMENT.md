# Version Management

This project uses a centralized version management system that automatically syncs version information across different parts of the application.

## Version Sources

The version is managed in the following order of priority:

1. **Environment Files** (`src/environments/environment.ts` and `src/environments/environment.prod.ts`)
2. **Package.json** (`package.json`)
3. **Fallback** (hardcoded '1.0.0')

## Version Service

The `VersionService` (`src/app/services/version.service.ts`) provides centralized access to version information:

```typescript
// Get full version (e.g., "1.0.0")
versionService.getVersion()

// Get version with prefix (e.g., "v1.0.0")
versionService.getVersionWithPrefix()

// Get short version (e.g., "1.0")
versionService.getShortVersion()

// Get short version with prefix (e.g., "v1.0")
versionService.getShortVersionWithPrefix()

// Check if in development mode
versionService.isDevelopment()

// Get complete build info
versionService.getBuildInfo()
```

## Usage in Components

```typescript
import { VersionService } from '../services/version.service';

export class MyComponent {
  constructor(private versionService: VersionService) {}
  
  // Use in template
  version = computed(() => this.versionService.getVersionWithPrefix());
}
```

## Updating Versions

### Method 1: Update package.json and sync
```bash
# 1. Update version in package.json
# 2. Run the sync script
npm run update-version
```

### Method 2: Update environment files directly
Edit the version in:
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

### Method 3: Use the update script
```bash
# The script will read from package.json and update environment files
npm run update-version
```

## Version Display

The version is automatically displayed in:
- **Sidebar**: Bottom of the navigation sidebar
- **Desktop**: Full version when expanded, short version when collapsed
- **Mobile**: Full version at bottom of mobile menu

## Environment-Specific Versions

You can set different versions for different environments:

```typescript
// Development
export const environment = {
  production: false,
  version: '1.0.0-dev',
  // ...
};

// Production
export const environment = {
  production: true,
  version: '1.0.0',
  // ...
};
```

## Build Information

The version service also provides build information:

```typescript
const buildInfo = versionService.getBuildInfo();
// Returns: { version: '1.0.0', environment: 'production', timestamp: '2024-01-15T10:30:00.000Z' }
```

## Best Practices

1. **Always update package.json first** when releasing a new version
2. **Run `npm run update-version`** to sync across all files
3. **Use the VersionService** instead of hardcoding versions
4. **Test version display** in both development and production builds
5. **Consider semantic versioning** (MAJOR.MINOR.PATCH)

## Troubleshooting

### Version not updating in UI
- Check that the VersionService is properly injected
- Verify environment files have the correct version
- Clear browser cache and rebuild

### Script not working
- Ensure Node.js is installed
- Check file permissions on scripts/update-version.js
- Verify package.json has a valid version field 