import {v2 as cloudinary, type ConfigOptions} from 'cloudinary';


/**
 * Cloudinary configuration interface 
 **/

interface CloudinaryConfig {
    cloud_name: string;
    api_key: string;
    api_secret: string;
    secure?: boolean;
}

type CloudinaryConf = Required<Pick<ConfigOptions, 'cloud_name' | 'api_key' | 'api_secret'>> & 
Partial<Omit<ConfigOptions,'cloud_name' | 'api_key' | 'api_secret'>>;


/**
 * Configuration result type
 */
interface ConfigurationResult {
  success: boolean;
  cloudinary: typeof cloudinary;
  error?: string;
}


/**
 * Configure Cloudinary with environment variables
 * @returns {ConfigurationResult} Configuration result with Cloudinary instance
 */
export function configureCloudinary(): ConfigurationResult {
  const config: CloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
    secure: true
  };

 
  // Validate required environment variables
  const missingVars: string[] = [];
  
  if (!config.cloud_name) missingVars.push('CLOUDINARY_CLOUD_NAME');
  if (!config.api_key) missingVars.push('CLOUDINARY_API_KEY');
  if (!config.api_secret) missingVars.push('CLOUDINARY_API_SECRET');

  if (missingVars.length > 0) {
    return {
      success: false,
      cloudinary,
      error: `Missing required Cloudinary environment variables: ${missingVars.join(', ')}`
    };
  }

  try {
    cloudinary.config(config);
    
    console.log('✅ Cloudinary configured successfully');
    return {
      success: true,
      cloudinary
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
    
    return {
      success: false,
      cloudinary,
      error: `Cloudinary configuration failed: ${errorMessage}`
    };
  }
}

// Export the configured cloudinary instance
export { cloudinary };