// Base extractor class/interface
// TODO: Implement base extractor contract

export class BaseExtractor {
  static platform = 'base';
  static patterns = [];

  static match(url) {
    // TODO: Implement
  }

  async extract(url, options) {
    // TODO: Implement
  }

  async refresh(mediaId) {
    // TODO: Implement
  }
}
