import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

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
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleCopyToClipboard = () => {
        const textToCopy = `ID do Cliente: ${clientId}\nNome da Máquina: ${machine}\nChave de acesso: ${accessToken}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 3000); // A mensagem desaparecerá após 3 segundos
        }, (err) => {
            console.error('Erro ao copiar: ', err);
            setCopySuccess(false);
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
                <title>Ingatec - Gerenciador de Dados de Impressoras</title>
            </Head>
            <div className="max-w-4xl mx-auto px-2 py-2">
                <div className="mb-0 flex items-center">
                    {/* Logo da Ingatec */}
                    <div className="logo">
                        <Image
                            src="/logo_ingatec.png" // O caminho é relativo à pasta public
                            alt="Logo Ingatec"
                            width={200} // Defina a largura conforme necessário
                            height={60} // Defina a altura conforme necessário
                        />
                    </div>
                </div>
            </div>
            <div className="max-w-4xl mx-auto px-2 py-2">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-semibold mb-6">Configurações</h1>
                    <button 
                        onClick={handleOpenModal} 
                        /* disabled={printers.length === 0 || !isClientActive}  */
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        {'Chave de acesso'}
                    </button>
                </div>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                            <div className="mt-3 text-center">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">Dados da Máquina</h3>
                                <div className="mt-2 px-7 py-3 text-left">
                                    <p><strong>ID do Cliente:</strong> {clientId}</p>
                                    <p><strong>Nome da Máquina:</strong> {machine}</p>
                                    <p><strong>Chave de acesso:</strong> {formatToken(accessToken)}</p>
                                </div>
                                <div className="items-center px-4 py-3">
                                    <button onClick={handleCopyToClipboard} className="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300">
                                        Copiar Dados
                                    </button>
                                    {copySuccess && <p className="text-sm text-green-600 mt-2">Dados copiados com sucesso!</p>}
                                </div>
                                <div className="items-center px-4 py-3">
                                    <button onClick={handleCloseModal} className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300">
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap -mx-3">
                    <div className="mb-8 px-3 w-full lg:w-1/3">
                        {/* <h2 className="text-xl font-semibold mb-3">Cliente:</h2> */}
                        <table className="table-auto w-full bg-white shadow-md rounded">
                            <thead className="bg-green-600 text-white">
                                <tr>
                                    <th className="px-4 py-2">Cliente</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-700">
                                {clientSelected ? (
                                    <tr key={clientSelected.id}>
                                        <td className="px-4 py-2 text-center">{clientSelected.companyname}</td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td className="px-4 py-2 text-center">Nenhum cliente encontrado.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mb-8 px-3 w-full lg:w-1/3">
                        {/* <h2 className="text-xl font-semibold mb-3">Periodicidade de aquisição de dados:</h2> */}
                        <table className="table-auto w-full bg-white shadow-md rounded">
                            <thead className="bg-green-600 text-white">
                                <tr>
                                    <th className="px-4 py-2">Período de Execução (horas)</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-700">
                                {settingsData ? (
                                    <tr key={settingsData.id} className="border-b">
                                        <td className="px-4 py-2 text-center">{settingsData.execution_period}</td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td className="px-4 py-2 text-center">Nenhuma configuração encontrada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mb-4 px-3 w-full lg:w-1/3">
                        <table className="table-auto w-full bg-white shadow-md rounded">
                            <thead className="bg-green-600 text-white">
                                <tr>
                                    <th className="px-4 py-2">ID do Cliente</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="text"
                                                id="client-id"
                                                value={clientId}
                                                onChange={(e) => setClientId(e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-600 focus:border-green-600 w-1/2"
                                            />
                                            <button 
                                                onClick={handleSave} 
                                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-opacity-50 w-1/2"
                                            >
                                                Salvar
                                            </button>
                                        </div>
                                        {saveSuccess && <p className="mt-2 text-green-600">Configurações salvas com sucesso!</p>}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-4">Impressoras cadastradas:</h2>
                    <table className="min-w-full divide-y divide-gray-200 shadow-md rounded">
                        <thead className="bg-green-600 text-white">
                            <tr>
                                <th className="px-4 py-2">IP</th>
                                <th className="px-4 py-2">Nome</th>
                                <th className="px-4 py-2">Modelo</th>
                                <th className="px-4 py-2">Toner</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {activePrinters.length > 0 && isClientActive ? (
                                activePrinters.map((printer) => (
                                    <tr key={printer.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">{printer.printer_ip}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">{printer.printer_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">{printer.printer_brand_model}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">{printer.printer_tonner_type}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-center">Nenhuma impressora encontrada para o cliente ou cliente está inativo.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold mb-4">Últimos dados das impressoras:</h2>
                        <button 
                            onClick={() => {
                                if (printers.length > 0 && isClientActive) {
                                    handleForceUpdate();
                                }
                            }}
                            disabled={isUpdating || printers.length === 0 || !isClientActive}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            {isUpdating ? 'Atualizando...' : 'Forçar atualização'}
                        </button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 shadow-md rounded">
                        <thead className="bg-green-600 text-white">
                            <tr>
                                <th className="px-4 py-2">Data e Hora</th>
                                <th className="px-4 py-2">Impressora</th>
                                <th className="px-4 py-2">Contagem de Cópias</th>
                                <th className="px-4 py-2">Nível de Toner</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reports.length > 0 && printers.length > 0 && isClientActive ? (
                                reports.slice().sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()).slice(0, 50).map((report) => {
                                    const printer = printers.find(p => p.id === report.printer_id);
                                    return (
                                        <tr key={report.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">{report.date_time}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">{printer ? printer.printer_name : 'Desconhecida'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">{report.current_copy_count}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">{report.current_toner_level}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-center">Nenhum relatório encontrado para o cliente ou cliente está inativo.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-center items-center space-x-4 my-4">
                    <p className="text-md text-gray-700">Versão: <span className="font-semibold">{info.version}</span></p>
                    <p className="text-md text-gray-700">Autor: <span className="font-semibold">{info.author}</span></p>
                </div>
            </div>
        </>
    );
}
