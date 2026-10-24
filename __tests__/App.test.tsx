/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../src/RustModule', () => ({
  RustModule: {
    add: jest.fn((a: number, b: number) => a + b),
    multiply: jest.fn((a: number, b: number) => a * b),
    isPositive: jest.fn((v: number) => v > 0),
    greeting: jest.fn((name: string) => `Hello, ${name}!`),
    setValue: jest.fn(() => true),
    getValues: jest.fn(() => new Float32Array(16)),
  },
}));

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
