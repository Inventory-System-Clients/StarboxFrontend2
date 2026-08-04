import { useEffect, useMemo, useState } from "react";

import api from "../services/api";

const CAMPOS_AJUSTE = [
  {
    chave: "quantidadeAtual",
    label: "Quantidade atual na maquina",
  },
  {
    chave: "contadorIn",
    label: "Contador IN",
  },
  {
    chave: "contadorOut",
    label: "Contador OUT",
  },
];

const valoresIniciais = {
  quantidadeAtual: "",
  contadorIn: "",
  contadorOut: "",
};

const selecaoInicial = {
  quantidadeAtual: false,
  contadorIn: false,
  contadorOut: false,
};

const somenteInteiroNaoNegativo = (valor) => String(valor || "").replace(/\D/g, "");

const formatarDataHora = (dataTexto) => {
  if (!dataTexto) return "";
  const data = new Date(dataTexto);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizarLista = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.lojas)) return payload.lojas;
  if (Array.isArray(payload?.maquinas)) return payload.maquinas;
  return [];
};

export default function AjusteMaquinaAtual() {
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [lojaId, setLojaId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [buscaLoja, setBuscaLoja] = useState("");
  const [buscaMaquina, setBuscaMaquina] = useState("");
  const [dadosAtuais, setDadosAtuais] = useState(null);
  const [camposSelecionados, setCamposSelecionados] =
    useState(selecaoInicial);
  const [valoresForm, setValoresForm] = useState(valoresIniciais);
  const [carregandoLojas, setCarregandoLojas] = useState(false);
  const [carregandoMaquinas, setCarregandoMaquinas] = useState(false);
  const [carregandoValores, setCarregandoValores] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const camposEditaveis = useMemo(() => {
    const campos = dadosAtuais?.camposEditaveis;
    return Array.isArray(campos) && campos.length > 0
      ? campos
      : CAMPOS_AJUSTE.map((campo) => campo.chave);
  }, [dadosAtuais]);

  const algumCampoSelecionado = Object.values(camposSelecionados).some(Boolean);
  const termoBuscaLoja = buscaLoja.trim().toLowerCase();
  const termoBuscaMaquina = buscaMaquina.trim().toLowerCase();

  const lojasFiltradas = useMemo(() => {
    if (!termoBuscaLoja) return lojas;
    return lojas.filter((loja) =>
      [
        loja?.nome,
        loja?.razaoSocial,
        loja?.cidade,
        loja?.endereco,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termoBuscaLoja)),
    );
  }, [lojas, termoBuscaLoja]);

  const maquinasFiltradas = useMemo(() => {
    if (!termoBuscaMaquina) return maquinas;
    return maquinas.filter((maquina) =>
      [
        maquina?.nome,
        maquina?.codigo,
        maquina?.modelo,
        maquina?.tipo,
      ]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLowerCase().includes(termoBuscaMaquina),
        ),
    );
  }, [maquinas, termoBuscaMaquina]);

  const formularioInvalido = useMemo(() => {
    if (!lojaId || !maquinaId || !algumCampoSelecionado || salvando) {
      return true;
    }

    return CAMPOS_AJUSTE.some((campo) => {
      if (!camposSelecionados[campo.chave]) return false;
      const valor = valoresForm[campo.chave];
      return valor === "" || !Number.isInteger(Number(valor)) || Number(valor) < 0;
    });
  }, [algumCampoSelecionado, camposSelecionados, lojaId, maquinaId, salvando, valoresForm]);

  const aplicarValoresAtuais = (payload) => {
    const valores = payload?.valoresAtuais || {};
    setDadosAtuais(payload || null);
    setValoresForm({
      quantidadeAtual:
        valores.quantidadeAtual === null || valores.quantidadeAtual === undefined
          ? ""
          : String(valores.quantidadeAtual),
      contadorIn:
        valores.contadorIn === null || valores.contadorIn === undefined
          ? ""
          : String(valores.contadorIn),
      contadorOut:
        valores.contadorOut === null || valores.contadorOut === undefined
          ? ""
          : String(valores.contadorOut),
    });
  };

  const obterMensagemErro = (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data || {};

    if (status === 404 && data.code === "MAQUINA_SEM_VALORES_ATUAIS") {
      return "Esta maquina ainda nao possui valores atuais para editar.";
    }

    if (status === 400) {
      return data.error || "Nao foi possivel salvar os valores informados.";
    }

    if (status === 403) {
      return "Seu usuario nao tem permissao para fazer este ajuste.";
    }

    return "Nao foi possivel concluir a operacao. Tente novamente.";
  };

  useEffect(() => {
    let cancelado = false;

    async function carregarLojas() {
      try {
        setCarregandoLojas(true);
        setErro("");
        const response = await api.get("/lojas");
        if (!cancelado) setLojas(normalizarLista(response.data));
      } catch (error) {
        if (!cancelado) setErro(obterMensagemErro(error));
      } finally {
        if (!cancelado) setCarregandoLojas(false);
      }
    }

    carregarLojas();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregarMaquinasDaLoja() {
      if (!lojaId) {
        setMaquinas([]);
        setMaquinaId("");
        setBuscaMaquina("");
        setDadosAtuais(null);
        setValoresForm(valoresIniciais);
        setCamposSelecionados(selecaoInicial);
        return;
      }

      try {
        setCarregandoMaquinas(true);
        setErro("");
        setSucesso("");
        setMaquinaId("");
        setBuscaMaquina("");
        setDadosAtuais(null);
        setValoresForm(valoresIniciais);
        setCamposSelecionados(selecaoInicial);
        const response = await api.get("/maquinas", { params: { lojaId } });
        if (!cancelado) setMaquinas(normalizarLista(response.data));
      } catch (error) {
        if (!cancelado) {
          setMaquinas([]);
          setErro(obterMensagemErro(error));
        }
      } finally {
        if (!cancelado) setCarregandoMaquinas(false);
      }
    }

    carregarMaquinasDaLoja();

    return () => {
      cancelado = true;
    };
  }, [lojaId]);

  useEffect(() => {
    let cancelado = false;

    async function carregarValoresAtuais() {
      if (!lojaId || !maquinaId) {
        setDadosAtuais(null);
        setValoresForm(valoresIniciais);
        setCamposSelecionados(selecaoInicial);
        return;
      }

      try {
        setCarregandoValores(true);
        setErro("");
        setSucesso("");
        setCamposSelecionados(selecaoInicial);
        const response = await api.get(
          `/admin/maquinas/${maquinaId}/ajuste-atual`,
          { params: { lojaId } },
        );
        if (!cancelado) aplicarValoresAtuais(response.data);
      } catch (error) {
        if (!cancelado) {
          setDadosAtuais(null);
          setValoresForm(valoresIniciais);
          setErro(obterMensagemErro(error));
        }
      } finally {
        if (!cancelado) setCarregandoValores(false);
      }
    }

    carregarValoresAtuais();

    return () => {
      cancelado = true;
    };
  }, [lojaId, maquinaId]);

  const alterarCampoSelecionado = (chave) => {
    setCamposSelecionados((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }));
  };

  const alterarValor = (chave, valor) => {
    setValoresForm((prev) => ({
      ...prev,
      [chave]: somenteInteiroNaoNegativo(valor),
    }));
  };

  const salvarAjuste = async (event) => {
    event.preventDefault();
    if (formularioInvalido) return;

    const confirmou = window.confirm(
      "Confirmar ajuste dos valores atuais desta maquina?",
    );
    if (!confirmou) return;

    const payload = { lojaId };
    CAMPOS_AJUSTE.forEach((campo) => {
      if (camposSelecionados[campo.chave]) {
        payload[campo.chave] = Number(valoresForm[campo.chave]);
      }
    });

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");
      const response = await api.patch(
        `/admin/maquinas/${maquinaId}/ajuste-atual`,
        payload,
      );
      aplicarValoresAtuais(response.data);
      setCamposSelecionados(selecaoInicial);
      setSucesso("Valores atuais salvos com sucesso.");
    } catch (error) {
      setErro(obterMensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="card-gradient mb-8 border-l-4 border-emerald-500 p-4 sm:p-8 rounded-xl shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <span className="bg-linear-to-br from-emerald-500 to-emerald-700 p-2 sm:p-3 rounded-xl text-white">
            #
          </span>
          Ajuste da Maquina
        </h2>
        <p className="text-gray-600 text-sm sm:text-base">
          Edite diretamente os valores atuais exibidos para uma maquina.
        </p>
      </div>

      <form onSubmit={salvarAjuste} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Loja
            </label>
            <input
              type="text"
              className="input-field w-full mb-2"
              value={buscaLoja}
              onChange={(event) => setBuscaLoja(event.target.value)}
              placeholder="Digite o nome da loja"
              disabled={carregandoLojas}
            />
            <select
              className="select-field w-full"
              value={lojaId}
              onChange={(event) => setLojaId(event.target.value)}
              disabled={carregandoLojas}
            >
              <option value="">
                {carregandoLojas ? "Carregando lojas..." : "Selecione uma loja"}
              </option>
              {lojasFiltradas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome || loja.razaoSocial || loja.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Maquina
            </label>
            <input
              type="text"
              className="input-field w-full mb-2"
              value={buscaMaquina}
              onChange={(event) => setBuscaMaquina(event.target.value)}
              placeholder="Digite o nome ou codigo da maquina"
              disabled={!lojaId || carregandoMaquinas}
            />
            <select
              className="select-field w-full"
              value={maquinaId}
              onChange={(event) => setMaquinaId(event.target.value)}
              disabled={!lojaId || carregandoMaquinas}
            >
              <option value="">
                {carregandoMaquinas
                  ? "Carregando maquinas..."
                  : "Selecione uma maquina"}
              </option>
              {maquinasFiltradas.map((maquina) => (
                <option key={maquina.id} value={maquina.id}>
                  {maquina.codigo
                    ? `${maquina.codigo} - ${maquina.nome || "Maquina"}`
                    : maquina.nome || maquina.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {carregandoValores && (
          <div className="rounded-lg bg-white/70 border border-emerald-100 p-4 text-sm text-emerald-900">
            Carregando valores atuais...
          </div>
        )}

        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700">
            {sucesso}
          </div>
        )}

        {dadosAtuais && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CAMPOS_AJUSTE.map((campo) => (
                <div
                  key={campo.chave}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                >
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    {campo.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {valoresForm[campo.chave] === ""
                      ? "-"
                      : Number(valoresForm[campo.chave]).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>

            {(dadosAtuais.valoresAtuais?.ultimaAtualizacao ||
              dadosAtuais.valoresAtuais?.atualizadoEm) && (
              <p className="text-xs text-gray-500">
                Ultima atualizacao:{" "}
                {formatarDataHora(
                  dadosAtuais.valoresAtuais?.ultimaAtualizacao ||
                    dadosAtuais.valoresAtuais?.atualizadoEm,
                )}
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {CAMPOS_AJUSTE.map((campo) => {
                const selecionado = camposSelecionados[campo.chave];
                const editavel = camposEditaveis.includes(campo.chave);

                return (
                  <div
                    key={campo.chave}
                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                  >
                    <label className="flex items-center gap-3 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alterarCampoSelecionado(campo.chave)}
                        disabled={!editavel}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm font-bold text-gray-900">
                        {campo.label}
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={valoresForm[campo.chave]}
                      onChange={(event) =>
                        alterarValor(campo.chave, event.target.value)
                      }
                      disabled={!selecionado || !editavel}
                      className={`input-field w-full ${
                        !selecionado || !editavel
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={formularioInvalido}
          >
            {salvando ? "Salvando..." : "Salvar ajuste"}
          </button>
        </div>
      </form>
    </section>
  );
}
