/**
 * Media Pipeline - State machine for media classification and delivery
 * 
 * UNIFIED approach - no separate handlers per format
 * Determines delivery strategy: redirect vs relay
 * 
 * States:
 * - INIT: URL received
 * - FETCHING: Getting source
 * - PARSING: Extracting media
 * - CLASSIFIED: Media info ready
 * - READY: Delivery strategy decided
 * - ERROR: Something went wrong
 */

import { analyze as analyzeMime } from './mime.helper.js';
import { getSize } from './size.helper.js';
import { logger } from '../../utils/logger.js';

/**
 * Pipeline states
 */
export const PipelineState = {
  INIT: 'INIT',
  FETCHING: 'FETCHING',
  PARSING: 'PARSING',
  CLASSIFIED: 'CLASSIFIED',
  READY: 'READY',
  ERROR: 'ERROR'
};

/**
 * Delivery modes
 */
export const DeliveryMode = {
  REDIRECT: 'redirect', // 302/307 to CDN URL (default, zero bandwidth)
  RELAY: 'relay'        // Backend pipes stream to client (fallback)
};

/**
 * Media Pipeline class
 */
export class MediaPipeline {
  constructor() {
    this.state = PipelineState.INIT;
    this.error = null;
    this.mediaInfo = null;
    this.deliveryMode = null;
  }

  /**
   * Classify media from extraction result
   * @param {object} format - Format object from extractor
   * @param {object} headers - Response headers (optional)
   * @returns {object} Classification result
   */
  classify(format, headers = {}) {
    this.state = PipelineState.CLASSIFIED;

    try {
      // Analyze MIME and format
      const mimeInfo = analyzeMime({
        url: format.url,
        contentType: format.mime || headers['content-type'],
        headers
      });

      // Get size info
      const sizeInfo = getSize({
        headers,
        duration: format.duration,
        bitrate: format.bitrate,
        format: mimeInfo.extension
      });

      // Determine delivery mode
      const deliveryMode = this.determineDeliveryMode(format, mimeInfo);

      this.mediaInfo = {
        ...mimeInfo,
        size: sizeInfo,
        deliveryMode,
        format
      };

      this.deliveryMode = deliveryMode;
      this.state = PipelineState.READY;

      return this.mediaInfo;

    } catch (error) {
      this.state = PipelineState.ERROR;
      this.error = error;
      logger.error('pipeline', 'Classification failed', error);
      throw error;
    }
  }

  /**
   * Determine delivery mode (redirect vs relay)
   * @param {object} format - Format object
   * @param {object} mimeInfo - MIME info from analysis
   * @returns {string} Delivery mode
   */
  determineDeliveryMode(format, mimeInfo) {
    // Default: redirect (zero bandwidth)
    // Relay only if:
    // 1. URL requires auth/cookies
    // 2. URL is IP-bound
    // 3. URL expires very quickly
    // 4. CORS issues expected

    // For now, default to redirect
    // TODO: Add logic to detect when relay is needed
    // - Check if URL has auth tokens
    // - Check if URL is from known problematic CDNs
    // - Check expiry time

    if (format.requiresRelay) {
      return DeliveryMode.RELAY;
    }

    // Playlist formats might need relay for segment handling
    if (mimeInfo.playlist) {
      return DeliveryMode.RELAY;
    }

    return DeliveryMode.REDIRECT;
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if pipeline is ready
   * @returns {boolean} True if ready
   */
  isReady() {
    return this.state === PipelineState.READY;
  }

  /**
   * Check if pipeline has error
   * @returns {boolean} True if error
   */
  hasError() {
    return this.state === PipelineState.ERROR;
  }

  /**
   * Get media info
   * @returns {object|null} Media info or null
   */
  getMediaInfo() {
    return this.mediaInfo;
  }

  /**
   * Get delivery mode
   * @returns {string|null} Delivery mode or null
   */
  getDeliveryMode() {
    return this.deliveryMode;
  }

  /**
   * Reset pipeline
   */
  reset() {
    this.state = PipelineState.INIT;
    this.error = null;
    this.mediaInfo = null;
    this.deliveryMode = null;
  }
}

/**
 * Quick classify helper (stateless)
 * @param {object} format - Format object
 * @param {object} headers - Response headers
 * @returns {object} Classification result
 */
export function classifyMedia(format, headers = {}) {
  const pipeline = new MediaPipeline();
  return pipeline.classify(format, headers);
}
