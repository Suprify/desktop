import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Clipboard, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Client {
    id: number;
    client_id: number;
    companyname: string;
    status: string;
}
interface Setting {
    id: number;
    client_id: number;
    billing_day: string;
    execution_period: number;
}

interface Printers {
    id: number;
    client_id: number;
    printer_ip: number;
    printer_name: string;
    printer_brand_model: string;
    printer_tonner_type: string;
    snmp_oid_community: string;
    snmp_oid_copy_count: string;
    snmp_oid_toner_level: string;
    status: string;
}

interface Reports {
    id: number;
    client_id: number;
    printer_id: number;
    date_time: string;
    current_copy_count: number;
    current_toner_level: string;
}

export default function Home() {
    const [settingsData, setSettingsData] = useState<Setting | null>(null);
    const [clientId, setClientId] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [printers, setPrinters] = useState<Printers[]>([]);
    const [activePrinters, setActivePrinters] = useState<Printers[]>([]);
    const [reports, setReports] = useState<Reports[]>([]);
    const [clientSelected, setSelectedClient] = useState<Client | null>(null);
    const [isClientActive, setIsClientActive] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [info, setInfo] = useState({ version: '', author: '' });
    const [machine, setMachineName] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);


    const handleOpenModal = async () => {
        /* if (printers.length > 0 && isClientActive) { */
            if (!accessToken) { // Se o token ainda não foi carregado
                await fetchAccessToken(); // Supondo que esta função atualiza `accessToken`
            }
            setIsModalOpen(true);
        /* } */
    };

    const fetchAccessToken = useCallback(async () => {
        if (typeof window !== "undefined" && window.electronAPI) {
            const machineName = await window.electronAPI.getMachineName();
            const token = await window.electronAPI.generateAccessToken();
            setAccessToken(token);
            setMachineName(machineName);
        }
    }, []);

    useEffect(() => {
        fetchAccessToken();
    }, [fetchAccessToken]);

    const fetchSettings = useCallback(async () => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const clientResponse = await fetch(`https://pdm.ingatec.com.br/api/clients/client_id/${clientId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Client-Id': clientId
                }
            });
            const [client] = await clientResponse.json();
            setSelectedClient(client);
    
            const settingResponse = await fetch(`https://pdm.ingatec.com.br/api/settings/client_id/${clientId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Client-Id': clientId
                }
            });
            const [setting] = await settingResponse.json();
            setSettingsData(setting);          
    
            if (client && client.status == 'Ativo') {
                setIsClientActive(true);
            } else {
                setIsClientActive(false);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }, [clientId, accessToken]);

    const fetchPrinters = useCallback(async () => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const printersResponse = await fetch(`https://pdm.ingatec.com.br/api/printers/client_id/${clientId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Client-Id': clientId
                }
            });
            const printersData = await printersResponse.json();
            setPrinters(printersData);
            const activePrinters = printersData.filter((printer: { status: string; }) => printer.status === 'Ativa');
            setActivePrinters(activePrinters);
        } catch (error) {
            console.error('Error fetching printers:', error);
        }
    }, [clientId, accessToken]);    

    const fetchReports = useCallback(async () => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const reportsResponse = await fetch(`https://pdm.ingatec.com.br/api/reports/client_id/${clientId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Client-Id': clientId
                }
            });
            const reportsData = await reportsResponse.json();
            setReports(reportsData);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
      }, [clientId, accessToken]);

    const postReportData = useCallback(async (reportData: { client_id: number; printer_id: number; date_time: string; current_copy_count: number; current_toner_level: string; }) => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const response = await fetch('https://pdm.ingatec.com.br/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Id': clientId
                },
                body: JSON.stringify(reportData)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            fetchReports();
        } catch (error) {
            console.error('Error posting report data:', error);
        }
    }, [fetchReports, accessToken, clientId]);

    async function fetchSnmpData(ip: number, oid: string, community: string) {
        try {
            const result = await window.electronAPI.getSnmpData(ip, oid, community);
            if (typeof result === 'number') {
                return result;
            } else {
                throw new Error('The returned value is not a number.');
            }
        } catch (error) {
            console.error('Error fetching SNMP data:', error);
            throw error;
        }
    }

    const collectPrinterDataAndReport = useCallback(async () => {
        const currentTime = new Date().toLocaleString('sv', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T');
        
        for (const printer of activePrinters) {
            try {
                const copyCount = await fetchSnmpData(printer.printer_ip, printer.snmp_oid_copy_count, printer.snmp_oid_community);
                const tonerLevel = await fetchSnmpData(printer.printer_ip, printer.snmp_oid_toner_level, printer.snmp_oid_community);

                const reportData = {
                    client_id: printer.client_id,
                    printer_id: printer.id,
                    date_time: currentTime,
                    current_copy_count: copyCount,
                    current_toner_level: tonerLevel.toString()
                };
                
                await postReportData(reportData);
            } catch (error) {
                console.error(`Error collecting data for printer ${printer.id}:`, error);
            }
        }
    }, [postReportData, activePrinters]);

    const loadData = useCallback(async () => {
        if (clientId) {
          await fetchSettings();
          await fetchPrinters();
          await fetchReports();
        }
    }, [clientId, fetchPrinters, fetchReports, fetchSettings]);

    const executeReportCollectionIfNeeded = useCallback(async () => {
        const now = new Date();
        const lastReportTime = new Date(localStorage.getItem('lastReportTime') || 0);
    
        if (settingsData) {
            const nextExecutionTime = new Date(lastReportTime.getTime() + settingsData.execution_period * 60 * 60 * 1000);
    
            if (now >= nextExecutionTime) {
                await loadData();
                await collectPrinterDataAndReport();
                localStorage.setItem('lastReportTime', now.toISOString());
            }
        } else {
            console.error('Execution settings not found for this client.');
        }
    }, [settingsData, collectPrinterDataAndReport, loadData]);

    const handleForceUpdate = useCallback(async () => {
        setIsUpdating(true);
        const now = new Date();
        const lastReportTime = new Date(localStorage.getItem('lastReportTime') || 0);
    
        try {
            await loadData();
            await collectPrinterDataAndReport();
            localStorage.setItem('lastReportTime', now.toISOString());
            toast.success("Atualização concluída", {
                description: "Os dados das impressoras foram atualizados com sucesso.",
            });
        } catch (error) {
            toast.error("Erro na atualização", {
                description: "Ocorreu um erro ao atualizar os dados.",
            });
        } finally {
            setIsUpdating(false);
        }
    }, [collectPrinterDataAndReport, loadData]);
    
    useEffect(() => {
        const storedClientId = localStorage.getItem('clientId');
        if (storedClientId) {
            setClientId(storedClientId);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined" && window.electronAPI) {
            window.electronAPI.on('config-data', (data: { client_id: { toString: () => any; }; }) => {
                const newClientId = data.client_id.toString();
                setClientId(newClientId);
                localStorage.setItem('clientId', newClientId);
            });
    
            return () => {
                window.electronAPI.removeAllListeners('config-data');
            };
        }
    }, []);

    useEffect(() => {
        loadData();
      }, [loadData]);
    
    useEffect(() => {
        const interval = setInterval(() => {
            loadData();
            if (isClientActive) {
                executeReportCollectionIfNeeded();
            }
        }, 60 * 5000);
        return () => clearInterval(interval);
    }, [loadData, isClientActive, executeReportCollectionIfNeeded]);

    const handleSave = () => {
        localStorage.setItem('clientId', clientId);
        window.electronAPI.send('save-settings', { client_id: parseInt(clientId, 10) });
        setSaveSuccess(true);
        toast.success("Configurações salvas", {
            description: "As configurações foram salvas com sucesso.",
        });
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleCopyToClipboard = () => {
        const textToCopy = `ID do Cliente: ${clientId}\nNome da Máquina: ${machine}\nChave de acesso: ${accessToken}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopySuccess(true);
            toast.success("Copiado!", {
                description: "Dados copiados para a área de transferência.",
            });
            setTimeout(() => setCopySuccess(false), 3000); // A mensagem desaparecerá após 3 segundos
        }, (err) => {
            setCopySuccess(false);
            toast.error("Erro ao copiar", {
                description: "Não foi possível copiar os dados.",
            });
        });
    };

    const formatToken = (token: string) => {
        if (token.length > 30) {
            return `${token.slice(0, 8)}...${token.slice(-8)}`;
        }
        return token;
    };   

    useEffect(() => {
        window.electronAPI.on('settings-saved', (event: any, data: { success: boolean | ((prevState: boolean) => boolean); }) => {
            setSaveSuccess(data.success);
        });

        return () => {
            window.electronAPI.removeAllListeners('settings-saved');
        };
    }, []);

    useEffect(() => {
        window.electronAPI.onAppInfoReceived((event, { version, author }) => {
            setInfo({ version, author });
        });
    }, []);

    return (
        <>
            <Head>
                <title>Suprify - Gestão de Outsourcing de Impressoras</title>
            </Head>
            <div className="max-w-4xl mx-auto p-4">
                <div className="mb-4 flex items-center">
                    <span className="font-bold text-lg text-primary">Suprify</span>
                </div>

                <Card className="mb-6">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                    <CardTitle>Configurações</CardTitle>
                    <Button onClick={handleOpenModal} variant="outline">
                        Chave de acesso
                    </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="bg-primary text-white py-2 px-4 rounded-t-lg">
                        <CardTitle className="text-sm font-medium">Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                        {clientSelected ? (
                            <p className="text-center">{clientSelected.companyname}</p>
                        ) : (
                            <p className="text-center text-muted-foreground">Nenhum cliente encontrado.</p>
                        )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="bg-primary text-white py-2 px-4 rounded-t-lg">
                        <CardTitle className="text-sm font-medium">Período de Execução (horas)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                        {settingsData ? (
                            <p className="text-center">{settingsData.execution_period}</p>
                        ) : (
                            <p className="text-center text-muted-foreground">Nenhuma configuração encontrada.</p>
                        )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="bg-primary text-white py-2 px-4 rounded-t-lg">
                        <CardTitle className="text-sm font-medium">ID do Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <Input
                            type="text"
                            id="client-id"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="flex-1"
                            />
                            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                            Salvar
                            </Button>
                        </div>
                        {saveSuccess && <p className="mt-2 text-primary text-sm">Configurações salvas com sucesso!</p>}
                        </CardContent>
                    </Card>
                    </div>
                </CardContent>
                </Card>

                <Card className="mb-6">
                <CardHeader className="pb-3">
                    <CardTitle>Impressoras cadastradas</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                    <TableHeader className="bg-primary text-white">
                        <TableRow>
                        <TableHead className="text-white">IP</TableHead>
                        <TableHead className="text-white">Nome</TableHead>
                        <TableHead className="text-white">Modelo</TableHead>
                        <TableHead className="text-white">Toner</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activePrinters.length > 0 && isClientActive ? (
                        activePrinters.map((printer) => (
                            <TableRow key={printer.id}>
                            <TableCell className="text-center">{printer.printer_ip}</TableCell>
                            <TableCell className="text-center">{printer.printer_name}</TableCell>
                            <TableCell className="text-center">{printer.printer_brand_model}</TableCell>
                            <TableCell className="text-center">{printer.printer_tonner_type}</TableCell>
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">
                            Nenhuma impressora encontrada para o cliente ou cliente está inativo.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </CardContent>
                </Card>

                <Card>
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                    <CardTitle>Últimos dados das impressoras</CardTitle>
                    <Button
                        onClick={() => {
                        if (printers.length > 0 && isClientActive) {
                            handleForceUpdate()
                        }
                        }}
                        disabled={isUpdating || printers.length === 0 || !isClientActive}
                        variant="outline"
                        className="gap-2"
                    >
                        {isUpdating ? (
                        <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Atualizando...
                        </>
                        ) : (
                        <>
                            <RefreshCw className="h-4 w-4" />
                            Forçar atualização
                        </>
                        )}
                    </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                    <TableHeader className="bg-primary text-white">
                        <TableRow>
                        <TableHead className="text-white">Data e Hora</TableHead>
                        <TableHead className="text-white">Impressora</TableHead>
                        <TableHead className="text-white">Contagem de Cópias</TableHead>
                        <TableHead className="text-white">Nível de Toner</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.length > 0 && printers.length > 0 && isClientActive ? (
                        reports
                            .slice()
                            .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
                            .slice(0, 50)
                            .map((report) => {
                            const printer = printers.find((p) => p.id === report.printer_id)
                            return (
                                <TableRow key={report.id}>
                                <TableCell className="text-center">{report.date_time}</TableCell>
                                <TableCell className="text-center">
                                    {printer ? printer.printer_name : "Desconhecida"}
                                </TableCell>
                                <TableCell className="text-center">{report.current_copy_count}</TableCell>
                                <TableCell className="text-center">{report.current_toner_level}</TableCell>
                                </TableRow>
                            )
                            })
                        ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">
                            Nenhum relatório encontrado para o cliente ou cliente está inativo.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </CardContent>
                </Card>

                <div className="flex justify-center items-center space-x-4 my-6">
                <Badge variant="outline" className="text-md">
                    Versão: {info.version}
                </Badge>
                <Badge variant="outline" className="text-md">
                    Autor: {info.author}
                </Badge>
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                    <DialogTitle>Dados da Máquina</DialogTitle>
                    <DialogDescription>Informações de acesso para esta máquina.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium col-span-1">ID do Cliente:</span>
                        <span className="col-span-3">{clientId}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium col-span-1">Nome da Máquina:</span>
                        <span className="col-span-3">{machine}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium col-span-1">Chave de acesso:</span>
                        <span className="col-span-3">{formatToken(accessToken)}</span>
                    </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleCopyToClipboard} className="w-full sm:w-auto bg-primary hover:bg-primary/90 gap-2">
                        <Clipboard className="h-4 w-4" />
                        Copiar Dados
                    </Button>
                    <Button onClick={handleCloseModal} variant="outline" className="w-full sm:w-auto">
                        Fechar
                    </Button>
                    </DialogFooter>
                </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
