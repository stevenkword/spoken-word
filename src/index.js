
import Speech from './speech';
export { setLocaleData } from './i18n';

/**
 * Mapping speech root elements to their corresponding Speech instances.
 *
 * @type {WeakMap<Element, Speech>}
 */
const speechRootMap = new WeakMap();

/**
 * Speech instances.
 *
 * @var {Speech[]}
 */
export const speeches = [];

// @todo Add WeakMap

/**
 * CSS selector for finding the content element.
 *
 * @type {string}
 */
const CONTENT_SELECTOR = '.hentry .entry-content, .h-entry .e-content, [itemprop="articleBody"]';

/**
 * Find article roots.
 *
 * @param {Element} root     - Root element.
 * @param {string}  selector - Selector.
 * @returns {Array} Article roots.
 */
function findContentRoots( root, selector ) {
	if ( root.matches( selector ) ) {
		return [ root ];
	}

	// @todo What about nested content?
	return [ ...root.querySelectorAll( selector ) ];
}

/**
 * Create Speech instances.
 *
 * @param {Element} element         - Element to look for content.
 * @param {string}  contentSelector - Selector for content elements.
 * @param {object}  chunkifyOptions - Options passed to chunkify().
 * @param {bool}    useDashicons    - Whether to use Dashicons in playback controls.
 * @param {object}  defaultUtteranceOptions - Options for utterance. (Deprecated.)
 */
function createSpeeches( { element, contentSelector, chunkifyOptions, useDashicons, defaultUtteranceOptions } ) {
	const rootElements = findContentRoots( element, contentSelector );
	for ( const rootElement of rootElements ) {
		const speech = new Speech( {
			rootElement,
			chunkifyOptions,
			useDashicons,
			defaultUtteranceOptions,
		} );

		// Skip elements already added.
		if ( speechRootMap.has( rootElement ) ) {
			continue;
		}

		speeches.push( speech );
		speechRootMap.set( rootElement, speech );

		// Stop playing all other speeches when playing one.
		speech.on( 'change:playback:playing', () => {
			for ( const otherSpeech of speeches ) {
				if ( otherSpeech !== speech ) {
					otherSpeech.stop();
				}
			}
		} );

		speech.initialize();
	}
}

/**
 * Destroy Speech instances in element.
 *
 * @param {Element} element         - Element to look for content.
 * @param {string}  contentSelector - Selector for content elements.
 */
function destroySpeeches( { element, contentSelector } ) {
	const speechRoots = findContentRoots( element, contentSelector );
	for ( const rootElement of speechRoots ) {
		const speech = speechRootMap.get( rootElement );
		if ( speech ) {
			speech.destroy();
			speechRootMap.delete( rootElement );
		}
	}
}

/**
 * Initialize.
 *
 * @param {Element} rootElement             - Root element.
 * @param {string}  contentSelector         - CSS Selector to find the elements for speaking.
 * @param {Object}  chunkifyOptions         - Options passed into chunkify.
 * @param {boolean} useDashicons            - Whether to use Dashicons.
 * @param {Object}  defaultUtteranceOptions - Options passed into chunkify.
 * @returns {Promise} Promise.
 */
export function initialize( {
	rootElement,
	contentSelector = CONTENT_SELECTOR,
	useDashicons,
	chunkifyOptions,
	defaultRate = 1.0, // @todo The options should really be stored globally, not just on a given site.
	defaultPitch = 1.0,
	defaultVoicePrefs,
} = {} ) {
	const mutationObserver = new MutationObserver( ( mutations ) => {
		for ( const mutation of mutations ) {
			for ( const addedNode of [ ...mutation.addedNodes ].filter( ( node ) => node.nodeType === Node.ELEMENT_NODE ) ) {
				createSpeeches( {
					element: addedNode,
					contentSelector,
					useDashicons,
					chunkifyOptions,
					defaultUtteranceOptions,
				} );
			}
			for ( const removedNode of [ ...mutation.removedNodes ].filter( ( node ) => node.nodeType === Node.ELEMENT_NODE ) ) {
				destroySpeeches( {
					element: removedNode,
					contentSelector,
				} );
			}
		}
	} );

	return new Promise( ( resolve ) => {
		const uponReady = () => {
			const element = rootElement || document.body;

			// Probably a bug in Chrome that utterance is not canceled upon unload.
			window.addEventListener( 'unload', () => {
				speechSynthesis.cancel();
			} );

			createSpeeches( {
				element,
				contentSelector,
				chunkifyOptions,
				useDashicons,
				defaultUtteranceOptions,
			} );

			mutationObserver.observe( element, {
				childList: true,
				subtree: true,
			} );

			resolve();
		};

		if ( 'complete' === document.readyState ) {
			uponReady();
		} else {
			document.addEventListener( 'DOMContentLoaded', uponReady );
		}
	} );
}
