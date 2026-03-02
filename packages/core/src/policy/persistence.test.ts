/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createPolicyUpdater, ALWAYS_ALLOW_PRIORITY } from './config.js';
import { PolicyEngine } from './policy-engine.js';
import { MessageBus } from '../confirmation-bus/message-bus.js';
import { MessageBusType } from '../confirmation-bus/types.js';
import { Storage, AUTO_SAVED_POLICY_FILENAME } from '../config/storage.js';
import { ApprovalMode } from './types.js';
import { coreEvents } from '../utils/events.js';

vi.mock('node:fs/promises');
vi.mock('../config/storage.js');
vi.mock('../utils/events.js', () => ({
  coreEvents: {
    emitFeedback: vi.fn(),
  },
}));

describe('createPolicyUpdater', () => {
  let policyEngine: PolicyEngine;
  let messageBus: MessageBus;
  let mockStorage: Storage;

  beforeEach(() => {
    policyEngine = new PolicyEngine({
      rules: [],
      checkers: [],
      approvalMode: ApprovalMode.DEFAULT,
    });
    messageBus = new MessageBus(policyEngine);
    mockStorage = new Storage('/mock/project');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Persistence logic', () => {
    it('should persist policy when persist flag is true', async () => {
      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      const userPoliciesDir = '/mock/user/.gemini/policies';
      const policyFile = path.join(userPoliciesDir, AUTO_SAVED_POLICY_FILENAME);
      vi.spyOn(mockStorage, 'getAutoSavedPolicyPath').mockReturnValue(policyFile);
      (fs.mkdir as unknown as Mock).mockResolvedValue(undefined);
      (fs.readFile as unknown as Mock).mockRejectedValue(
        new Error('File not found'),
      ); // Simulate new file

      const mockFileHandle = {
        writeFile: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (fs.open as unknown as Mock).mockResolvedValue(mockFileHandle);
      (fs.rename as unknown as Mock).mockResolvedValue(undefined);

      const toolName = 'test_tool';
      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName,
        persist: true,
      });

      // Wait for async operations (microtasks)
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fs.mkdir).toHaveBeenCalledWith(userPoliciesDir, {
        recursive: true,
      });

      expect(fs.open).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), 'wx');

      // Check written content
      const expectedContent = expect.stringContaining(`toolName = "test_tool"`);
      expect(mockFileHandle.writeFile).toHaveBeenCalledWith(
        expectedContent,
        'utf-8',
      );
      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringMatching(/\.tmp$/),
        policyFile,
      );
    });

    it('should not persist policy when persist flag is false or undefined', async () => {
      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName: 'test_tool',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fs.rename).not.toHaveBeenCalled();
    });

    it('should persist policy with commandPrefix when provided', async () => {
      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      const userPoliciesDir = '/mock/user/.gemini/policies';
      const policyFile = path.join(userPoliciesDir, AUTO_SAVED_POLICY_FILENAME);
      vi.spyOn(mockStorage, 'getAutoSavedPolicyPath').mockReturnValue(policyFile);
      (fs.mkdir as unknown as Mock).mockResolvedValue(undefined);
      (fs.readFile as unknown as Mock).mockRejectedValue(
        new Error('File not found'),
      );

      const mockFileHandle = {
        writeFile: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (fs.open as unknown as Mock).mockResolvedValue(mockFileHandle);
      (fs.rename as unknown as Mock).mockResolvedValue(undefined);

      const toolName = 'run_shell_command';
      const commandPrefix = 'git status';

      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName,
        persist: true,
        commandPrefix,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // In-memory rule check
      const rules = policyEngine.getRules();
      const addedRule = rules.find((r) => r.toolName === toolName);
      expect(addedRule).toBeDefined();
      expect(addedRule?.priority).toBe(ALWAYS_ALLOW_PRIORITY);

      // Verify file written
      expect(fs.open).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), 'wx');
      expect(mockFileHandle.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`commandPrefix = "git status"`),
        'utf-8',
      );
    });

    it('should persist policy with mcpName and toolName when provided', async () => {
      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      const userPoliciesDir = '/mock/user/.gemini/policies';
      const policyFile = path.join(userPoliciesDir, AUTO_SAVED_POLICY_FILENAME);
      vi.spyOn(mockStorage, 'getAutoSavedPolicyPath').mockReturnValue(policyFile);
      (fs.mkdir as unknown as Mock).mockResolvedValue(undefined);
      (fs.readFile as unknown as Mock).mockRejectedValue(
        new Error('File not found'),
      );

      const mockFileHandle = {
        writeFile: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (fs.open as unknown as Mock).mockResolvedValue(mockFileHandle);
      (fs.rename as unknown as Mock).mockResolvedValue(undefined);

      const mcpName = 'my-jira-server';
      const simpleToolName = 'search';
      const toolName = `${mcpName}__${simpleToolName}`;

      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName,
        persist: true,
        mcpName,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify file written
      expect(fs.open).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), 'wx');
      const writeCall = mockFileHandle.writeFile.mock.calls[0];
      const writtenContent = writeCall[0] as string;
      expect(writtenContent).toContain(`mcpName = "${mcpName}"`);
      expect(writtenContent).toContain(`toolName = "${simpleToolName}"`);
      expect(writtenContent).toContain('priority = 200');
    });
  });

  describe('Safeguards', () => {
    it('should reject wildcard tool name from auto-persistence', async () => {
      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName: '*',
        persist: true,
      });

      expect(coreEvents.emitFeedback).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('Broad approval for "*" was not auto-saved'),
      );
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should reject catch-all regex from auto-persistence', async () => {
      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName: 'read_file',
        persist: true,
        argsPattern: '.*',
      });

      expect(coreEvents.emitFeedback).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('Broad approval for "read_file" was not auto-saved'),
      );
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should reject unspecific sensitive tool approval', async () => {
      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName: 'read_file',
        persist: true,
        isSensitive: true,
      });

      expect(coreEvents.emitFeedback).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('Approvals for sensitive tools must be specific'),
      );
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should de-duplicate identical rules before persisting', async () => {
      const existingPolicy = `
[[rule]]
toolName = "read_file"
decision = "allow"
priority = 100
argsPattern = ".*\\"file_path\\":\\"test.ts\\".*"
`;
      vi.mocked(fs.readFile).mockResolvedValue(existingPolicy);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.spyOn(mockStorage, 'getAutoSavedPolicyPath').mockReturnValue('test-policy.toml');

      createPolicyUpdater(policyEngine, messageBus, mockStorage);

      await messageBus.publish({
        type: MessageBusType.UPDATE_POLICY,
        toolName: 'read_file',
        persist: true,
        argsPattern: '.*"file_path":"test.ts".*',
      });

      // Wait for async queue
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not write if duplicate
      expect(fs.open).not.toHaveBeenCalled();
    });
  });
});
