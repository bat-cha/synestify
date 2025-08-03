import { describe, it, expect, beforeEach } from 'vitest';
import { setupCounter } from './counter';

describe('setupCounter', () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    button = document.createElement('button');
    document.body.appendChild(button);
  });

  it('should initialize counter to 0', () => {
    setupCounter(button);
    expect(button.innerHTML).toBe('count is 0');
  });

  it('should increment counter on click', () => {
    setupCounter(button);
    
    button.click();
    expect(button.innerHTML).toBe('count is 1');
    
    button.click();
    expect(button.innerHTML).toBe('count is 2');
  });
});