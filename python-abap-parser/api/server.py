"""FastAPI server for ABAP parsing and conversion"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from abap_parser.parser import ABAPParser, ABAPFileType
from converters.cds_converter import CDSConverter
from converters.report_converter import ReportConverter
from converters.bw_converter import BWConverter
from converters.fm_converter import FMConverter

app = FastAPI(title="ABAP Parser API", version="1.0.0")
parser = ABAPParser()

converters = {
    'CDS_VIEW': CDSConverter(),
    'ABAP_REPORT': ReportConverter(),
    'BW_TRANSFORMATION': BWConverter(),
    'FUNCTION_MODULE': FMConverter(),
}


class AnalyzeRequest(BaseModel):
    content: str
    file_type: str = 'AUTO_DETECT'


class ConvertRequest(BaseModel):
    abapContent: str
    fileType: str
    targetName: str
    spaceId: str
    includeFields: Optional[list[str]] = None
    excludeFields: Optional[list[str]] = None


class HelpRequest(BaseModel):
    topic: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "abap-parser"}


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    try:
        if request.file_type == 'AUTO_DETECT':
            file_type = parser.detect_file_type(request.content)
        else:
            file_type = ABAPFileType(request.file_type)

        result = parser.parse(request.content)

        analysis = {
            'type': result.file_type.value,
            'sourceTables': [],
            'joins': [],
            'fields': [],
            'filters': [],
            'aggregations': [],
            'annotations': [],
            'estimatedComplexity': 'low',
            'warnings': result.warnings,
        }

        if result.cds_view:
            analysis['sourceTables'] = result.cds_view.source_tables
            analysis['annotations'] = result.cds_view.annotations
            analysis['joins'] = [
                {'type': j.join_type, 'table': j.table, 'on': j.condition}
                for j in result.cds_view.joins
            ]
            analysis['fields'] = [
                {'name': f.name, 'alias': f.alias, 'key': f.is_key}
                for f in result.cds_view.fields
            ]
            if result.cds_view.where_clause:
                analysis['filters'].append(result.cds_view.where_clause)

        elif result.select_statements:
            for stmt in result.select_statements:
                analysis['sourceTables'].append(stmt.from_table)
                analysis['fields'].extend([{'name': f} for f in stmt.fields])
                if stmt.where_clause:
                    analysis['filters'].append(stmt.where_clause)
                analysis['joins'].extend([
                    {'type': j.join_type, 'table': j.table, 'on': j.condition}
                    for j in stmt.joins
                ])

        elif result.bw_transformation:
            t = result.bw_transformation
            analysis['fields'] = [{'name': f.name} for f in t.target_fields]

        elif result.function_module:
            fm = result.function_module
            analysis['sourceTables'] = [s.from_table for s in fm.select_statements]

        return analysis

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/convert")
async def convert(request: ConvertRequest):
    try:
        parsed = parser.parse(request.abapContent)

        converter = converters.get(request.fileType)
        if not converter:
            raise HTTPException(status_code=400, detail=f'Unknown file type: {request.fileType}')

        result = converter.convert(parsed, request.targetName, request.spaceId)
        return {
            'sql': result.sql,
            'jsonDefinition': result.json_definition,
            'cliCommand': result.cli_command,
            'warnings': result.warnings,
            'metadata': result.metadata,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/help")
async def help_topic(request: HelpRequest):
    help_content = {
        'CDS_VIEW': {
            'description': 'CDS View Entity conversion',
            'supported_patterns': [
                'DEFINE VIEW ENTITY ... AS SELECT FROM',
                'LEFT/INNER/RIGHT OUTER JOIN',
                'WHERE, GROUP BY, HAVING',
                'KEY fields',
                'Aliases (AS)',
                'Annotations (@)',
            ],
            'examples': [
                'define view ZI_SALES as select from vbak { key vbeln as SalesOrder }',
            ],
        },
        'SELECT': {
            'description': 'ABAP Open SQL SELECT conversion',
            'supported_patterns': [
                'SELECT ... FROM ... WHERE',
                'INNER/LEFT JOIN ... ON',
                'GROUP BY ... HAVING',
                'ORDER BY ... UP TO n ROWS',
                'INTO TABLE',
            ],
        },
        'BW_TRANSFORMATION': {
            'description': 'BW Transformation rule conversion',
            'supported_patterns': [
                'SOURCE -> TARGET (formula)',
                'Field mappings',
                'Calculations',
                'Aggregations',
            ],
        },
        'FUNCTION_MODULE': {
            'description': 'Function Module conversion',
            'supported_patterns': [
                'SELECT statements within FM',
                'USING/CHANGING parameters',
                'TABLES parameters',
            ],
        },
        'ALL': {
            'description': 'All supported ABAP patterns',
            'types': ['CDS_VIEW', 'ABAP_REPORT', 'BW_TRANSFORMATION', 'FUNCTION_MODULE'],
        },
    }

    topic = request.topic.upper()
    if topic in help_content:
        return help_content[topic]
    return help_content['ALL']
