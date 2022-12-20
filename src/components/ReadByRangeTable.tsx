import React, { useCallback, useState } from "react";
import { Data } from "../types/data";
import { ReadByRangeResult } from "../types/result";
import { readByRange as executeIndexedDB } from "../helpers/indexedDB/actions";
import { readByRange as executeSQLite } from "../helpers/sqlite/actions";
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
} from "@chakra-ui/react";
import { convertMsToS } from "../helpers/convert";
import { ArrowRightIcon } from "@chakra-ui/icons";

const formatResult = (result: ReadByRangeResult): ReadByRangeResult => ({
  nTransactionStartRange: convertMsToS(result.nTransactionStartRange),
  nTransactionMiddleRange: convertMsToS(result.nTransactionMiddleRange),
  nTransactionEndRange: convertMsToS(result.nTransactionEndRange),
  oneTransactionStartRange: convertMsToS(result.oneTransactionStartRange),
  oneTransactionMiddleRange: convertMsToS(result.oneTransactionMiddleRange),
  oneTransactionEndRange: convertMsToS(result.oneTransactionEndRange),
});

interface Props {
  getDataset(): Array<Data>;
  addLog(content: string): number;
  removeLog(logId: number): void;
}

const ReadByRangeTable: React.FC<Props> = ({
  getDataset,
  addLog,
  removeLog,
}) => {
  const [indexedDBResult, setIndexedDBResult] =
    useState<ReadByRangeResult | null>(null);
  const [sqliteResult, setSQLiteResult] = useState<ReadByRangeResult | null>(
    null
  );

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [isSQLiteRunning, setIsSQLiteRunning] = useState(false);

  const toast = useToast();

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    setTimeout(() => {
      const dataset = getDataset();
      executeIndexedDB(dataset, addLog, removeLog)
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
  }, [getDataset, toast, addLog, removeLog]);

  const runSQLite = useCallback(() => {
    setIsSQLiteRunning(true);
    const dataset = getDataset();

    executeSQLite(dataset, addLog, removeLog)
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
  }, [getDataset, toast, addLog, removeLog]);

  return (
    <TableContainer marginTop={8} w="100%">
      <Table variant="simple">
        <TableCaption>
          Unit of measurement is <Text as="b">second</Text>.
        </TableCaption>
        <Thead>
          <Tr>
            <Th rowSpan={2} width={270}>
              DB Engine
            </Th>
            <Th colSpan={3} textAlign="center">
              n transaction
            </Th>
            <Th colSpan={3} textAlign="center">
              1 transaction
            </Th>
          </Tr>
          <Tr>
            <Th textAlign="center">1</Th>
            <Th textAlign="center">2</Th>
            <Th textAlign="center">3</Th>
            <Th textAlign="center">1</Th>
            <Th textAlign="center">2</Th>
            <Th textAlign="center">3</Th>
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
                    : indexedDBResult.nTransactionStartRange}
                </Td>
                <Td textAlign="center">
                  {indexedDBResult === null
                    ? "..."
                    : indexedDBResult.nTransactionMiddleRange}
                </Td>
                <Td textAlign="center">
                  {indexedDBResult === null
                    ? "..."
                    : indexedDBResult.nTransactionEndRange}
                </Td>
                <Td textAlign="center">
                  {indexedDBResult === null
                    ? "..."
                    : indexedDBResult.oneTransactionStartRange}
                </Td>
                <Td textAlign="center">
                  {indexedDBResult === null
                    ? "..."
                    : indexedDBResult.oneTransactionMiddleRange}
                </Td>
                <Td textAlign="center">
                  {indexedDBResult === null
                    ? "..."
                    : indexedDBResult.oneTransactionEndRange}
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
                    : sqliteResult.nTransactionStartRange}
                </Td>
                <Td textAlign="center">
                  {sqliteResult === null
                    ? "..."
                    : sqliteResult.nTransactionMiddleRange}
                </Td>
                <Td textAlign="center">
                  {sqliteResult === null
                    ? "..."
                    : sqliteResult.nTransactionEndRange}
                </Td>
                <Td textAlign="center">
                  {sqliteResult === null
                    ? "..."
                    : sqliteResult.oneTransactionStartRange}
                </Td>
                <Td textAlign="center">
                  {sqliteResult === null
                    ? "..."
                    : sqliteResult.oneTransactionMiddleRange}
                </Td>
                <Td textAlign="center">
                  {sqliteResult === null
                    ? "..."
                    : sqliteResult.oneTransactionEndRange}
                </Td>
              </>
            )}
          </Tr>
        </Tbody>
      </Table>
    </TableContainer>
  );
};

export default ReadByRangeTable;
