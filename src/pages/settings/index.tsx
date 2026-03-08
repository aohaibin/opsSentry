import { useEffect, useState } from "react";
import { Card, Typography, Table, message, Tag } from "antd";
import type { AppConfig } from "@/types";
import { configApi } from "@/lib/api";

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadConfigs() {
    setLoading(true);
    try {
      const data = await configApi.getAll();
      setConfigs(data);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfigs();
  }, []);

  const columns = [
    {
      title: "配置键",
      dataIndex: "key",
      key: "key",
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "配置值",
      dataIndex: "value",
      key: "value",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <Title level={3}>设置</Title>
      <Text type="secondary">应用配置管理（数据来自 Rust SQLite）</Text>

      <Card title="配置列表" className="mt-6">
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="key"
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
