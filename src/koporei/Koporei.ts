import fs from 'fs';
import path from 'path';
import { error } from '../utils';
import IKoporeiConfig from './KoporeiConfig';
import KoporeiRoute from './KoporeiRoute';
import { preprocessors } from './preprocessors';
import IKoporeiHooks from './IKoporeiHooks';

let config: IKoporeiConfig;

function withoutExtension(text: string): string {
    return text.replace(/\.\w+$/gi, '');
}

export async function initRoute(
	configDir: string,
	currentDir: string,
): Promise<void> {
	return new Promise((resolve, rejects) => {
		fs.exists(configDir, exists => {
			if (exists) {
				fs.readdir(currentDir, (err, files) => {
					if (err) throw err;
					if (hooks.onLoadStart) hooks.onLoadStart();
					for (const file of files) {
						const filePath = path.join(currentDir, file);
						fs.lstat(filePath, (err, stats) => {
							if (err) return rejects(err);
							if (stats.isFile()) {

								let route: KoporeiRoute;
	
								let routePath = withoutExtension(
									filePath.slice(configDir.length).replace(/\\/g, '/')
								).replace(/(index)$/g, '');
		
								if (config.isLowerCase) routePath = routePath.toLowerCase();
		
								if (path.extname(filePath) === '.js') {
									route = new KoporeiRoute({
										filePath,
										path: routePath,
										method: {
											name: 'POST',
											callback: require(filePath).default || require(filePath)
										}
									})
								} else {
									const search = preprocessors.filter(p => p.extension === path.extname(filePath).replace(/^\./g, ''));
									route = new KoporeiRoute({
										filePath,
										path: routePath,
										method: {
											name: 'GET',
											callback: () => {
												const f = config.isSinglePage ?
													path.join(process.cwd(), path.normalize(config.isSinglePage))
													: filePath;
												return fs.readFileSync(f).toString();
											}
										}
									})
									if (search.length > 0) {
										for (const cb of search) {
											cb.transform(route, cb.options);
										}
									}
								}
		
								if (route) {
									routes.set(`${route.method.name}|${route.path}`, route);
									if (config.hooks && config.hooks.onRouteAdded) config.hooks.onRouteAdded(route);
								}
		
							} else {
								resolve(initRoute(configDir, filePath));
							}

							if (hooks.onLoadEnd) hooks.onLoadEnd();
							resolve();
							
						})
					}
				})
			} else {
				rejects('This path doesn\'t exist: ' + configDir);
			}
		})
	});
}

export default async function(opts?: IKoporeiConfig) {
	if (opts?.pages) {
		config = {
			...opts,
			pages: path.join(process.cwd(), path.normalize(opts.pages)),
		};
		if (config.hooks) hooks = config.hooks;
		initRoute(config.pages, config.pages)
			.catch(err => {
				throw err;
			});
	} else {
		throw error("Can't find root path.");
	}
}

export const routes: Map<string, KoporeiRoute> = new Map();

export let hooks: IKoporeiHooks = {
	onExecute: () => {},
	onLoadStart: () => {},
	onLoadEnd: () => {},
	onRouteAdded: () => {}
};