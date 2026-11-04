import rootConfig from '../../next.config.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=fileURLToPath(new URL('./prisma.mjs',import.meta.url));
export default {...rootConfig,outputFileTracingRoot:root,typescript:{ignoreBuildErrors:true},
  experimental:{...rootConfig.experimental,externalDir:true},
  webpack(config,context){config=rootConfig.webpack(config,context);config.resolve.alias={'@/lib/prisma$':fixture,'@':root,...config.resolve.alias};return config;},
};
