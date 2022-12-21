import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
} from "@chakra-ui/react";

import { Data } from "./types/data";
import { generateData } from "./helpers/generate-data";
import { LogObj } from "./types/logs";
import { DEFAULT_DATASET_SIZE, MIN_DATASET_SIZE } from "./constants/dataset";
import SingleReadWriteTable from "./components/SingleReadWriteTable";
import ReadByRangeTable from "./components/ReadByRangeTable";
import ReadAllTable from "./components/ReadAllTable";
import { loadData } from "./helpers/indexedDB/load-data";
import { RepeatIcon } from "@chakra-ui/icons";
import ReadFromTheEndOfSourceDataTable from "./components/ReadFromTheEndOfSourceDataTable";

let logIdCounter = 0;

function App() {
  const [datasetSize, setDatasetSize] = useState(DEFAULT_DATASET_SIZE);
  const [dataset, setDataset] = useState<Data[]>([]);

  const [isLoadingData, setIsLoadingData] = useState(false);

  const [logs, setLogs] = useState<Array<LogObj>>([]);

  const handleDatasetSizeChange = useCallback((size) => {
    setDatasetSize(size);
  }, []);

  const addLog = useCallback((content: string) => {
    const id = logIdCounter++;
    const logObj: LogObj = { id, content };
    setLogs((prevState) => [...prevState, logObj]);
    return id;
  }, []);

  const removeLog = useCallback((id: number) => {
    setLogs((prevState) =>
      prevState.filter(({ id: currentId }) => currentId !== id)
    );
  }, []);

  const generateDataset = useCallback(async () => {
    const logId = addLog("[common] Generate data ...");
    setIsLoadingData(true);
    // Generate new dataset
    setTimeout(() => {
      const newDataset = generateData(datasetSize);
      setDataset(newDataset);
      removeLog(logId);
      setIsLoadingData(false);
    });
  }, [addLog, removeLog, datasetSize]);

  useEffect(() => {
    setIsLoadingData(true);
    loadData().then((data) => {
      const size = data.length;
      if (size > 0) {
        setDatasetSize(size);
        setDataset(data);
      }
      setIsLoadingData(false);
    });
  }, []);

  return (
    <Container
      padding={4}
      minW={700}
      maxW="unset"
      height="100vh"
      display="flex"
      flexDir="column"
    >
      <Heading size="md" marginBottom={4}>
        DB engine benchmark{" "}
        <span role="img" aria-label="">
          🧪
        </span>
      </Heading>
      <FormControl display="flex" alignItems="center" marginBottom={8}>
        <FormLabel margin="0" marginRight="4">
          Dataset size (n):
        </FormLabel>
        <NumberInput
          min={MIN_DATASET_SIZE}
          flexGrow={1}
          value={datasetSize}
          onChange={handleDatasetSizeChange}
          isDisabled={isLoadingData}
        >
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Button
          isLoading={isLoadingData}
          colorScheme="orange"
          leftIcon={<RepeatIcon />}
          onClick={generateDataset}
          marginLeft={8}
        >
          Generate
        </Button>
      </FormControl>
      <Grid width="100%" templateColumns="repeat(2, 1fr)" gap={4}>
        <GridItem colStart={0} colEnd={1}>
          <SingleReadWriteTable
            dataset={dataset}
            addLog={addLog}
            removeLog={removeLog}
          />
        </GridItem>
        <GridItem colStart={0} colEnd={1}>
          <ReadByRangeTable
            dataset={dataset}
            addLog={addLog}
            removeLog={removeLog}
          />
        </GridItem>
        <GridItem colStart={1} colEnd={2} rowStart={1}>
          <ReadAllTable
            dataset={dataset}
            addLog={addLog}
            removeLog={removeLog}
          />
        </GridItem>
        <GridItem colStart={1} colEnd={2} rowStart={2}>
          <ReadFromTheEndOfSourceDataTable
            dataset={dataset}
            addLog={addLog}
            removeLog={removeLog}
          />
        </GridItem>
      </Grid>
      <Flex marginTop="auto" height="68px" overflowY="auto">
        <Text fontSize={14} marginRight={2} fontWeight={600}>
          <span role="img" aria-label="">
            📃
          </span>{" "}
          Log:
        </Text>
        <Flex direction="column" gap="5px">
          {logs.map(({ id, content }) => (
            <Text key={id} fontSize={14}>
              {content}
            </Text>
          ))}
        </Flex>
      </Flex>
    </Container>
  );
}

export default App;
