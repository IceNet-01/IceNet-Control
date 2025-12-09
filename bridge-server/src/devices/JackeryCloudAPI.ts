import crypto from 'crypto';
import axios from 'axios';

const API_BASE = 'https://iot.jackeryapp.com/v1';
const AES_KEY = '1234567890123456';

// Jackery RSA public key for encrypting the AES key
const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCrqFxS4Tpe5ZJE1wEpKZVxvvdh
 XlNuCqzqhvmEgxqWGCF3joYR3bvVLH8v3LMUKwKs4w4kZl8wNjKJhzFGpLz2KQQJ
0Gi8nqnzJkPWnJdDSx2qnKpEyOXGqL7mJRF/XGPgvKFDqGJXvBYPqQGwjMZBY0mM
oBqH3XuZZGqGVKCXjwIDAQAB
-----END PUBLIC KEY-----`;

export interface JackeryCredentials {
  account: string;
  password: string;
}

export interface JackeryDeviceData {
  deviceId: string;
  deviceName: string;
  productId: string;
  productModel: string;
  properties: {
    rb?: number; // Battery remaining percentage
    bt?: number; // Battery temperature (divide by 10)
    op?: number; // Output power
    oac?: number; // AC output power
    odc?: number; // DC output power
    acip?: number; // AC input power
    ip?: number; // Input power
    [key: string]: any;
  };
}

export class JackeryCloudAPI {
  private token?: string;
  private credentials: JackeryCredentials;

  constructor(credentials: JackeryCredentials) {
    this.credentials = credentials;
  }

  /**
   * Encrypt data using AES-128-ECB
   */
  private aesEncrypt(data: string): string {
    const cipher = crypto.createCipheriv('aes-128-ecb', AES_KEY, '');
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  /**
   * Encrypt AES key using RSA public key
   */
  private rsaEncrypt(data: string): string {
    const encrypted = crypto.publicEncrypt(
      {
        key: RSA_PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(data)
    );
    return encrypted.toString('base64');
  }

  /**
   * Login to Jackery cloud and get authentication token
   */
  async login(): Promise<string> {
    try {
      // Encrypt credentials
      const encryptedAccount = this.aesEncrypt(this.credentials.account);
      const encryptedPassword = this.aesEncrypt(this.credentials.password);
      const encryptedKey = this.rsaEncrypt(AES_KEY);

      // Generate a unique device ID (UDID)
      const udid = crypto.randomBytes(16).toString('hex');

      const payload = {
        account: encryptedAccount,
        password: encryptedPassword,
        udid: udid,
        appIdentifier: 'com.hbxn.jackery',
        key: encryptedKey,
      };

      const response = await axios.post(`${API_BASE}/auth/login`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'platform': '1',
          'app_version': '1.0.5',
        },
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        console.log('[JackeryAPI] Successfully logged in');
        return this.token!;
      } else {
        throw new Error('No token received from login response');
      }
    } catch (error: any) {
      console.error('[JackeryAPI] Login failed:', error.response?.data || error.message);
      throw new Error(`Jackery login failed: ${error.message}`);
    }
  }

  /**
   * Get list of devices bound to the account
   */
  async getDeviceList(): Promise<JackeryDeviceData[]> {
    if (!this.token) {
      await this.login();
    }

    try {
      const response = await axios.get(`${API_BASE}/device/bind/list`, {
        headers: {
          'token': this.token!,
          'platform': '1',
          'app_version': '1.0.5',
          'Content-Type': 'application/json',
        },
      });

      return response.data.data || [];
    } catch (error: any) {
      console.error('[JackeryAPI] Failed to get device list:', error.response?.data || error.message);
      // Token might be expired, try to login again
      if (error.response?.status === 401) {
        await this.login();
        return this.getDeviceList();
      }
      throw error;
    }
  }

  /**
   * Get detailed properties for a specific device
   */
  async getDeviceProperties(deviceId: string): Promise<any> {
    if (!this.token) {
      await this.login();
    }

    try {
      const response = await axios.get(`${API_BASE}/device/property`, {
        params: { deviceId },
        headers: {
          'token': this.token!,
          'platform': '1',
          'app_version': '1.0.5',
          'Content-Type': 'application/json',
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('[JackeryAPI] Failed to get device properties:', error.response?.data || error.message);
      // Token might be expired, try to login again
      if (error.response?.status === 401) {
        await this.login();
        return this.getDeviceProperties(deviceId);
      }
      throw error;
    }
  }

  /**
   * Parse device properties into a friendly format
   */
  parseDeviceStatus(properties: any): {
    batteryLevel: number;
    batteryTemp: number;
    outputPower: number;
    inputPower: number;
    acOutput: number;
    dcOutput: number;
    acInput: number;
  } {
    return {
      batteryLevel: properties.rb || 0,
      batteryTemp: properties.bt ? properties.bt / 10 : 0,
      outputPower: properties.op || 0,
      inputPower: properties.ip || 0,
      acOutput: properties.oac || 0,
      dcOutput: properties.odc || 0,
      acInput: properties.acip || 0,
    };
  }
}
