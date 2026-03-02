/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { updatePolicy } from './policy.js';
import { MessageBusType } from '../confirmation-bus/types.js';
import type {
 SerializableConfirmationDetails ,
  ToolConfirmationOutcome,
  type AnyDeclarativeTool } from '../tools/tools.js';
import { makeFakeConfig } from '../test-utils/config.js';
import { type MessageBus } from '../confirmation-bus/message-bus.js';

describe('Auto-Add Policy Scheduler', () => {
  const mockMessageBus = {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  } as unknown as MessageBus;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate argsPattern for read_file', async () => {
    const config = makeFakeConfig({ autoAddPolicy: true });
    const tool = {
      name: 'read_file',
      isSensitive: true,
    } as unknown as AnyDeclarativeTool;

    const details = {
      type: 'edit',
      filePath: 'src/index.ts',
    } as unknown as SerializableConfirmationDetails;

    await updatePolicy(tool, ToolConfirmationOutcome.ProceedAlways, details, {
      config,
      messageBus: mockMessageBus,
    });

    expect(mockMessageBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageBusType.UPDATE_POLICY,
        toolName: 'read_file',
        persist: true,
        argsPattern: '.*"file_path":"src/index\\.ts".*',
      }),
    );
  });

  it('should generate argsPattern with escaped characters for read_file', async () => {
    const config = makeFakeConfig({ autoAddPolicy: true });
    const tool = {
      name: 'read_file',
      isSensitive: true,
    } as unknown as AnyDeclarativeTool;

    const details = {
      type: 'edit',
      filePath: 'src/[test].ts',
    } as unknown as SerializableConfirmationDetails;

    await updatePolicy(tool, ToolConfirmationOutcome.ProceedAlways, details, {
      config,
      messageBus: mockMessageBus,
    });

    expect(mockMessageBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        argsPattern: '.*"file_path":"src/\\[test\\]\\.ts".*',
      }),
    );
  });

  it('should generate argsPattern for web_fetch', async () => {
    const config = makeFakeConfig({ autoAddPolicy: true });
    const tool = {
      name: 'web_fetch',
      isSensitive: true,
    } as unknown as AnyDeclarativeTool;

    const details = {
      type: 'info',
      urls: ['https://example.com'],
    } as unknown as SerializableConfirmationDetails;

    await updatePolicy(tool, ToolConfirmationOutcome.ProceedAlways, details, {
      config,
      messageBus: mockMessageBus,
    });

    expect(mockMessageBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        argsPattern: '.*(https://example\\.com).*',
      }),
    );
  });

  it('should generate argsPattern for ls (search type)', async () => {
    const config = makeFakeConfig({ autoAddPolicy: true });
    const tool = {
      name: 'ls',
      isSensitive: true,
    } as unknown as AnyDeclarativeTool;

    const details = {
      type: 'search',
      dirPath: 'src/utils',
    } as unknown as SerializableConfirmationDetails;

    await updatePolicy(tool, ToolConfirmationOutcome.ProceedAlways, details, {
      config,
      messageBus: mockMessageBus,
    });

    expect(mockMessageBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageBusType.UPDATE_POLICY,
        toolName: 'ls',
        persist: true,
        argsPattern: '.*"dir_path":"src/utils".*',
      }),
    );
  });

  it('should not persist if autoAddPolicy is false', async () => {
    const config = makeFakeConfig({ autoAddPolicy: false });
    const tool = {
      name: 'read_file',
      isSensitive: true,
    } as unknown as AnyDeclarativeTool;

    const details = {
      type: 'edit',
      filePath: 'src/index.ts',
    } as unknown as SerializableConfirmationDetails;

    await updatePolicy(tool, ToolConfirmationOutcome.ProceedAlways, details, {
      config,
      messageBus: mockMessageBus,
    });

    expect(mockMessageBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        persist: false,
      }),
    );
  });

  it('should still persist if ProceedAlwaysAndSave is used, even if autoAddPolicy is false', async () => {
    const config = makeFakeConfig({ autoAddPolicy: false });
    const tool = {
      name: 'read_file',
      isSensitive: true,
    } as unknown as AnyDeclarativeTool;

    const details = {
      type: 'edit',
      filePath: 'src/index.ts',
    } as unknown as SerializableConfirmationDetails;

    await updatePolicy(
      tool,
      ToolConfirmationOutcome.ProceedAlwaysAndSave,
      details,
      {
        config,
        messageBus: mockMessageBus,
      },
    );

    expect(mockMessageBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        persist: true,
      }),
    );
  });
});
