import React, { useCallback, useMemo, useState } from "react";
import { Data } from "../types/data";
import { ReadByRangeResult } from "../types/result";
import { readByIndex as executeIndexedDB } from "../helpers/indexedDB/actions";
import { readByIndex as executeSQLite } from "../helpers/sqlite/actions";
import {
  Flex,
  IconButton,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  useToast,
  Heading,
  FormControl,
  FormLabel,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
} from "@chakra-ui/react";
import { convertMsToS } from "../helpers/convert";
import { ArrowRightIcon } from "@chakra-ui/icons";
import {
  MIN_NUM_OF_INDEXED_KEYS,
  DEFAULT_NUM_OF_INDEXED_KEYS,
} from "../constants/dataset";
import { getConvId } from "../helpers/generate-data";

const formatResult = (result: ReadByRangeResult): ReadByRangeResult => ({
  nTransactionAverage: convertMsToS(result.nTransactionAverage),
  nTransactionSum: convertMsToS(result.nTransactionSum),
  oneTransactionAverage: convertMsToS(result.oneTransactionAverage),
  oneTransactionSum: convertMsToS(result.oneTransactionSum),
});

interface Props {
  dataset: Array<Data>;
  addLog(content: string): number;
  removeLog(logId: number): void;
}

const ReadByIndexTable: React.FC<Props> = ({ dataset, addLog, removeLog }) => {
  const [numOfKeys, setNumOfKeys] = useState(DEFAULT_NUM_OF_INDEXED_KEYS);
  const [indexedDBResult, setIndexedDBResult] =
    useState<ReadByRangeResult | null>(null);
  const [sqliteResult, setSQLiteResult] = useState<ReadByRangeResult | null>(
    null
  );

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [isSQLiteRunning, setIsSQLiteRunning] = useState(false);

  const keys = useMemo(() => {
    const res: string[] = [];
    for (let i = 0; i < numOfKeys; i += 1) {
      res.push(getConvId());
    }
    return res;
  }, [numOfKeys]);

  const toast = useToast();

  const handleNumOfIndexedKeysChange = useCallback((value) => {
    setNumOfKeys(value);
  }, []);

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    setTimeout(() => {
      executeIndexedDB(dataset, addLog, removeLog, { keys })
        .then((result) => {
          setIndexedDBResult(formatResult(result));
        })
        .catch((e) => {
          toast({
            title: "IndexedDB error",
            description: e.message,
            status: "error",
          });
          console.error(e);
        })
        .finally(() => {
          setIsIndexedDBRunning(false);
        });
    });
  }, [dataset, toast, addLog, removeLog, keys]);

  const runSQLite = useCallback(() => {
    setIsSQLiteRunning(true);

    executeSQLite(dataset, addLog, removeLog, { keys })
      .then((result) => {
        setSQLiteResult(formatResult(result));
      })
      .catch((e) => {
        toast({
          title: "SQLite error",
          description: e.message,
          status: "error",
        });
        console.error(e);
      })
      .finally(() => {
        setIsSQLiteRunning(false);
      });
  }, [dataset, toast, addLog, removeLog, keys]);

  return (
    <Flex direction="column" h="100%">
      <Heading size="sm" marginBottom={4}>Read by range</Heading>
      <FormControl display="flex" alignItems="center" marginBottom={2}>
        <FormLabel margin="0" marginRight="4">
          Num of indexed keys (m):
        </FormLabel>
        <NumberInput
          min={MIN_NUM_OF_INDEXED_KEYS}
          flexGrow={1}
          value={numOfKeys}
          onChange={handleNumOfIndexedKeysChange}
        >
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </FormControl>
      <TableContainer w="100%" height="285px" marginTop="auto">
        <Table variant="simple">
          <TableCaption>
            Generated indexed keys are available in the dataset but can be
            non-unique.
            <br />
            Unit of measurement is <Text as="b">second</Text>.
          </TableCaption>
          <Thead>
            <Tr>
              <Th rowSpan={2} width={270}>
                DB Engine
              </Th>
              <Th colSpan={2} textAlign="center">
                n transaction
              </Th>
              <Th colSpan={2} textAlign="center">
                1 transaction
              </Th>
            </Tr>
            <Tr>
              <Th textAlign="center">Read (Total)</Th>
              <Th textAlign="center">Read (Average)</Th>
              <Th textAlign="center">Read (Total)</Th>
              <Th textAlign="center">Read (Average)</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>
                <Flex justifyContent={"space-between"} alignItems="center">
                  <Text>IndexedDB</Text>
                  <IconButton
                    colorScheme="teal"
                    icon={<ArrowRightIcon />}
                    size="sm"
                    isLoading={isIndexedDBRunning}
                    aria-label={"run IndexedDB"}
                    onClick={runIndexedDB}
                  />
                </Flex>
              </Td>
              {isIndexedDBRunning ? (
                <Td backgroundColor="gray.100" colSpan={6} textAlign="center">
                  Running...
                </Td>
              ) : (
                <>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.nTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.nTransactionAverage}
                  </Td>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.oneTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.oneTransactionAverage}
                  </Td>
                </>
              )}
            </Tr>
            <Tr>
              <Td>
                <Flex justifyContent={"space-between"} alignItems="center">
                  <Text>SQLite</Text>
                  <IconButton
                    colorScheme="teal"
                    icon={<ArrowRightIcon />}
                    size="sm"
                    isLoading={isSQLiteRunning}
                    aria-label={"run SQLite"}
                    onClick={runSQLite}
                  />
                </Flex>
              </Td>
              {isSQLiteRunning ? (
                <Td backgroundColor="gray.100" colSpan={6} textAlign="center">
                  Running...
                </Td>
              ) : (
                <>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.nTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.nTransactionAverage}
                  </Td>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.oneTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.oneTransactionAverage}
                  </Td>
                </>
              )}
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </Flex>
  );
};

export default ReadByIndexTable;
