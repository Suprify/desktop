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
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Client {
    id: string;
    companyId: string;
    name: string;
    billingDay: number;
    executionPeriod: number;
    status: string;
}

interface Printers {
    id: string;
    customerId: string;
    ipAddress: string;
    serialNumber: string;
    model: string;
    networkName: string;
    printerType: string;
    status: string;
    mode: string;
    supplyType: string;
    machineId: string;
    approvedPrinterId: string;
}

interface SnmpCommands {
    id: string;
    approvedPrinterId: string;
    commandName: string;
    oid: string;
    community: string;
}

interface Reports {
    id: string;
    printerId: string;
    createdAt: string;
    commandName: string;
    value: string;
    ipAddress: string,
    serialNumber: string,
    model: string,
    networkName: string,
    printerType: string,
    status: string
}

export default function Home() {
    const [customerId, setCustomerId] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [printers, setPrinters] = useState<Printers[]>([]);
    const [activePrinters, setActivePrinters] = useState<Printers[]>([]);
    const [snmpCommands, setSnmpCommands] = useState<SnmpCommands[]>([]);
    const [reports, setReports] = useState<Reports[]>([]);
    const [customerSelected, setCustomerSelected] = useState<Client | null>(null);
    const [isClientActive, setIsClientActive] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [info, setInfo] = useState({ version: '', author: '' });
    const [machine, setMachineName] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const api_url = process.env.NEXT_PUBLIC_API_URL;

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

    const fetchCustomer = useCallback(async () => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const clientResponse = await fetch(`${api_url}/api/customers/${customerId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                }
            });
            const client = await clientResponse.json();

            console.log('Client:', client);
            setCustomerSelected(client);      
    
            if (client && client.status == 'ACTIVE') {
                setIsClientActive(true);
            } else {
                setIsClientActive(false);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }, [customerId, accessToken]);

    const fetchPrinters = useCallback(async () => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const printersResponse = await fetch(`${api_url}/api/printers/${customerId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                }
            });
            const printersData = await printersResponse.json();
            setPrinters(printersData);
            const activePrintersData = await printersData.filter((printer: { status: string; mode: string; }) => printer.status === 'ACTIVE' && printer.mode === 'AUTO');
            setActivePrinters(activePrintersData);
            console.log('activePrintersData:', activePrintersData);
        } catch (error) {
            console.error('Error fetching printers:', error);
        }
    }, [customerId, accessToken]);

    const fetchSnmpCommands = useCallback(async () => {
        if (!accessToken) {
            return; 
        }

        try {
            const updatedSnmpCommands: SnmpCommands[] = [...snmpCommands];

            for (const printer of activePrinters) {
                try {
                    console.log('printer:', printer);
                    console.log('Chamando API para buscar comandos SNMP...');
                    const snmpCommandsResponse = await fetch(`${api_url}/api/snmpcommands?approvedPrinterId=${printer.approvedPrinterId}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        }
                    });

                    const snmpCommandsData: SnmpCommands[] = await snmpCommandsResponse.json();

                    snmpCommandsData.forEach((command) => {
                        const exists = updatedSnmpCommands.some((existingCommand) => existingCommand.id === command.id);
                        if (!exists) {
                            updatedSnmpCommands.push(command);
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching SNMP commands for printer ${printer.id}:`, error);
                }
            }

            setSnmpCommands(updatedSnmpCommands);

            console.log('snmpCommands:', updatedSnmpCommands);
        }
        catch (error) {
            console.error('Error fetching approved printers:', error);
        }
    }, [activePrinters, accessToken]);

    const fetchReports = useCallback(async () => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const reportsResponse = await fetch(`${api_url}/api/reports?customerId=${customerId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                }
            });
            const reportsData = await reportsResponse.json();
            setReports(reportsData);
            console.log('reports:', reportsData);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
      }, [customerId, accessToken]);

    const postReportData = useCallback(async (reportData: { printerId: string; createdAt: string; commandName: string; value: string; }) => {
        if (!accessToken) {
            return; 
        }
        
        try {
            const response = await fetch(`${api_url}/api/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
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
    }, [fetchReports, accessToken, customerId]);

    async function fetchSnmpData(ip: string, oid: string, community: string) {
        try {
            const result = await window.electronAPI.getSnmpData(ip, oid, community);
            return result;
        } catch (error) {
            console.error('Error fetching SNMP data:', error);
            throw error;
        }
    }

    const collectPrinterDataAndReport = useCallback(async () => {
        const currentTime = new Date().toISOString();
        if (activePrinters.length === 0) {
            console.error('No active printers found.');
            return;
        }
        await fetchSnmpCommands();
        for (const printer of activePrinters) {
            for (const command of snmpCommands) {
                try {
                    const value = await fetchSnmpData(printer.ipAddress, command.oid, command.community);
                    console.log('SNMP data:', value);
                    if (value === undefined || value === null) {
                        console.error(`Error fetching SNMP data for printer ${printer.id} and command ${command.commandName}`);
                        continue;
                    }
                    const reportData = {
                        printerId: printer.id,
                        createdAt: currentTime,
                        commandName: command.commandName,
                        value: value.toString()
                    };
                    console.log('reportData POST:', reportData);
                    await postReportData(reportData);
                } catch (error) {
                    console.error(`Error collecting data for printer ${printer.id}:`, error);
                }
            }
        }
    }, [postReportData, activePrinters, snmpCommands]);

    const loadData = useCallback(async () => {
        if (customerId) {
          await fetchCustomer();
          await fetchPrinters();
          await fetchReports();
        }
    }, [customerId, fetchPrinters, fetchReports, fetchCustomer]);

    const executeReportCollectionIfNeeded = useCallback(async () => {
        const now = new Date();
        const lastReportTime = new Date(localStorage.getItem('lastReportTime') || 0);
    
        if (customerSelected) {
            const nextExecutionTime = new Date(lastReportTime.getTime() + customerSelected.executionPeriod * 60 * 60 * 1000);
    
            if (now >= nextExecutionTime) {
                await loadData();
                await collectPrinterDataAndReport();
                localStorage.setItem('lastReportTime', now.toISOString());
            }
        } else {
            console.error('Execution settings not found for this client.');
        }
    }, [customerSelected, collectPrinterDataAndReport, loadData]);

    const handleForceUpdate = useCallback(async () => {
        setIsUpdating(true);
        const now = new Date();
    
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
        const storedClientId = localStorage.getItem('customerId');
        if (storedClientId) {
            setCustomerId(storedClientId);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined" && window.electronAPI) {
            window.electronAPI.on('config-data', (data: { client_id: { toString: () => any; }; }) => {
                const newClientId = data.client_id.toString();
                setCustomerId(newClientId);
                localStorage.setItem('customerId', newClientId);
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
        localStorage.setItem('customerId', customerId);
        window.electronAPI.send('save-settings', { client_id: parseInt(customerId, 10) });
        setSaveSuccess(true);
        toast.success("Configurações salvas", {
            description: "As configurações foram salvas com sucesso.",
        });
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleCopyToClipboard = () => {
        const textToCopy = `ID do Cliente: ${customerId}\nNome da Máquina: ${machine}\nChave de acesso: ${accessToken}`;
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
                        {customerSelected ? (
                            <p className="text-center">{customerSelected.name}</p>
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
                        {customerSelected ? (
                            <p className="text-center">{customerSelected.executionPeriod}</p>
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
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
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
                        <TableHead className="text-white">Número de Série</TableHead>
                        <TableHead className="text-white">Modelo</TableHead>
                        <TableHead className="text-white">Nome na Rede</TableHead>
                        <TableHead className="text-white">Suprimento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activePrinters.length > 0 && isClientActive ? (
                        activePrinters.map((printer) => (
                            <TableRow key={printer.id}>
                            <TableCell className="text-center">{printer.ipAddress}</TableCell>
                            <TableCell className="text-center">{printer.serialNumber}</TableCell>
                            <TableCell className="text-center">{printer.model}</TableCell>
                            <TableCell className="text-center">{printer.networkName}</TableCell>
                            <TableCell className="text-center">{printer.supplyType}</TableCell>
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
                        <TableHead className="text-white">Número de Série</TableHead>
                        <TableHead className="text-white">Modelo</TableHead>
                        <TableHead className="text-white">Nome na Rede</TableHead>
                        <TableHead className="text-white">Nome do Comando</TableHead>
                        <TableHead className="text-white">Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.length > 0 && activePrinters.length > 0 && isClientActive ? (
                        reports
                            .filter((report) => activePrinters.some((printer) => printer.id === report.printerId))
                            .slice()
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .slice(0, 20)
                            .map((report) => {
                            const printer = activePrinters.find((p) => p.id === report.printerId);
                            return (
                                <TableRow key={report.id}>
                                <TableCell className="text-center">
                                    {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                                </TableCell>
                                <TableCell className="text-center">{report.serialNumber}</TableCell>
                                <TableCell className="text-center">{report.model}</TableCell>
                                <TableCell className="text-center">{report.networkName}</TableCell>
                                <TableCell className="text-center">{report.commandName}</TableCell>
                                <TableCell className="text-center">{report.value}</TableCell>
                                </TableRow>
                            );
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
                        <span className="col-span-3">{customerId}</span>
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
