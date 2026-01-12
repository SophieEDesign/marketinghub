/**
 * Unified Filter System
 * 
 * This module provides the canonical filter model and evaluation engine
 * used throughout the application.
 * 
 * All filters must conform to the canonical model defined here.
 * All filter evaluation must go through the shared evaluation engine.
 */

export * from './canonical-model'
export * from './evaluation'
export * from './converters'
